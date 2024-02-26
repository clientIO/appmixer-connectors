'use strict';
const commons = require('../commons');

/**
 * Return Set of inputs (defined by componentId:outputPort) that the component is waiting for. It is
 * basically set of all the input links.
 * @param  context
 * @return {Set<any>}
 */
function awaitedInputs(context) {

    // create set of all sourceComponentId:sourceOutput port combinations
    // we will be checking this in the receive() method
    const inputs = new Set();
    Object.keys(context.flowDescriptor[context.componentId].source.in).forEach(connectedComponentId => {
        context.flowDescriptor[context.componentId].source.in[connectedComponentId].forEach(outputPort => {
            inputs.add(`${connectedComponentId}:${outputPort}`);
        });
    });

    return inputs;
}

/**
 * Return if a message/signal arrived from all connected links.
 * @param {Object} state
 * @param context
 * @return {Promise<boolean>}
 */
async function allArrived(state, context) {

    const connectedComponents = Object.keys(context.flowDescriptor[context.componentId].source.in).length;
    if (connectedComponents === 1) {
        return true;
    }

    const walkThroughItem = context.scope['_walkthrough'][context.scope['_walkthrough'].length - 1];
    const sourceComponentId = walkThroughItem.links[0].sourceId;
    const sourceOutputPort = walkThroughItem.links[0].sourceOut;
    const inputMessageSourceId = `${sourceComponentId}:${sourceOutputPort}`;

    const inputsArrived = state.inputsArrived ? new Set(state.inputsArrived) : new Set();
    inputsArrived.add(inputMessageSourceId);

    if (inputsArrived.size >= awaitedInputs(context).size) {
        await context.stateUnset('inputsArrived');
        return true;
    }
    await context.stateSet('inputsArrived', Array.from(inputsArrived));
    return false;
}

/**
 * Handle timeout.
 * @param {Object} state
 * @param context
 * @return {Promise<*>}
 */
async function timedOut(state, context) {

    if (context.messages.timeout.content.runId !== context.state.runId) {
        // when afterAll is processed before timeout arrives, state is cleared, then ignore
        // this timeout
        return;
    }
    // this will delete the state and set timesOut, only next signal can remove this and make it work again
    await context.saveState({ timedOut: true });

    // Join components use the flow state to clear their states
    await context.flow.stateSet(commons.STATE, { done: new Date() });

    const connectedLinks = (Object.keys(context.flowDescriptor[context.componentId].source.in) || []).map(
        componentId => {
            return context.flowDescriptor[context.componentId].source.in[componentId].map(outputPort =>
                `${componentId}:${outputPort}`
            );
        }
    ).flat();

    const arrived = state.inputsArrived || [];

    return context.sendJson({
        message: 'timed out',
        timedOutLinks: connectedLinks
            .filter(linkId => !arrived.includes(linkId))
            .map(linkId =>
                `${context.flowDescriptor[linkId.split(':')[0]].label
                || context.flowDescriptor[linkId.split(':')[0]].type}:${linkId.split(':')[1]}`
            )
    }, 'out');
}

module.exports = {

    async start(context) {

        return commons.registerSignalReceiver(context);
    },

    async signal(context) {

        // signal has to be sent before the test start, this is done through BeforeAll component.
        // there are other signal, we want to ignore those and wait for the one from BeforeAll component
        if (context.signal.content.beforeAll) {
            let lock = null;
            try {
                const runId = context.signal.content.beforeAll.runId;
                lock = await context.lock(runId);
                const state = await context.loadState();

                // signal from appmixer.utils.test components can arrive multiple times,
                // we want to set the timeout only once
                if (state.runId !== runId) {
                    const timeoutId = await context.setTimeout({ runId }, context.properties.timeout * 1000);
                    await context.saveState({ timeoutId, runId, inputsArrived: [] });

                    // send information back to the BeforeAll component - it is waiting for it, until then
                    // it won't send anything to the output port - which basically means that the test flow
                    // between BeforeAll -> AfterAll is paused until the AfterAll processes the signal and
                    // sets the state
                    await context.sendSignal({
                        componentId: context.componentId,
                        componentType: context.type,
                        runId: context.signal.content.beforeAll.runId
                    });
                }
            } finally {
                lock && lock.unlock();
            }
        }
    },

    async receive(context) {

        let lock = null;

        try {
            lock = await context.lock(context.componentId);
            const state = await context.loadState();

            if (state.timedOut) {
                return;
            }

            if (context.messages.timeout) {
                return timedOut(state, context);
            }

            const connectedComponents = Object.keys(context.flowDescriptor[context.componentId].source.in).length;

            // if there is only one connected component, just pass the content to out port
            if (connectedComponents === 1) {
                await context.clearTimeout(state.timeoutId);
                await context.stateClear();
                await context.flow.stateSet(commons.STATE, { done: new Date });
                return context.sendJson(context.messages.in.content, 'out');
            }

            state.inputMessages = state.inputMessages || [];
            state.inputMessages.push(context.messages.in.content);

            // the scope for the output port message has to contain scope of all the input links (branches)
            // that way any variable from any branch can be used behind the AfterAll component.
            // the problem is the _walkthrough, _walkthrough won't look correctly and will contain _walkthrough
            // of the last messages that arrives into the AfterAll component - will equal the path of the last
            // message
            state.scope = state.scope || {};
            state.scope = Object.assign(state.scope, context.scope);

            if (await allArrived(state, context)) {
                // all awaited messages have arrived
                await context.clearTimeout(state.timeoutId);
                await context.stateClear();
                await context.flow.stateSet(commons.STATE, { done: new Date() });
                return context.sendJson(state.inputMessages, 'out', { scope: state.scope });
            } else {
                await context.stateSet('inputMessages', state.inputMessages);
                await context.stateSet('scope', state.scope);
            }
        } finally {
            lock && lock.unlock();
        }
    }
};
