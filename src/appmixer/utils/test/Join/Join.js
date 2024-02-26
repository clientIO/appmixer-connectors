'use strict';
const Promise = require('bluebird');
const commons = require('../commons');

function findRunIdFromScope(context) {

    let runId = null;
    Object.keys(context.flowDescriptor).forEach(componentId => {
        if (context.flowDescriptor[componentId].type === 'appmixer.utils.test.BeforeAll') {
            runId = context.scope[componentId].out?.runId;
        }
    });

    if (runId === null) {
        throw new Error('BeforeAll component not found in the flow.');
    }

    return runId;
}

module.exports = {

    async receive(context) {

        let lock = null;

        try {
            lock = await context.lock(context.componentId);
            const state = await context.loadState();
            const flowState = await context.flow.stateGet(commons.STATE);

            if (!flowState || flowState?.done) {
                // message arrived before the BeforeAll component's receive() method finished,
                // or the AfterAll component set the `done`, if the flow timedOut or all links
                // finished, then we don't care about incoming messages, throw them away,
                // ignore them
                await context.stateClear();
                return;
            }

            if (context.messages.join) {
                state.join = context.messages.join.content;
                state.joinScope = context.scope;
                state.runId = findRunIdFromScope(context);
            }

            if (context.messages.in) {
                state.queue = state.queue || [];
                state.queue.push({
                    content: context.messages.in.content,
                    scope: context.scope
                });
            }

            // if join message arrived and it's a join message from the current run (generated after BeforeAll
            // finished), then we can start sending out messages. If it's an old join message in the state from
            // the previous run, we ignore it and wait for it
            if (state.join && state.runId === flowState.runId && state.queue && state.queue.length) {
                await Promise.map(state.queue, item => {
                    const scope = Object.assign(item.scope, state.joinScope);
                    return context.sendJson({ join: state.join, in: item.content }, 'out', { scope });
                });
                state.queue = [];
            }

            await context.saveState(state);
        } finally {
            lock && lock.unlock();
        }
    }
};
