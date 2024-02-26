'use strict';
const uuid = require('uuid');
const commons = require('../commons');

module.exports = {

    async signal(context) {

        // signals are used to wait for all the appmixer.utils.test components that do process
        // signals from BeforeAll (like CallCount, AfterAll). After they all send a signal back
        // to the BeforeAll, the flow will continue, the BeforeAll will send a message to its
        // output port

        let lock = null;
        try {
            lock = await context.lock(context.componentId);
            if (context.signal.content.runId !== context.state.runId) {
                // any lost signal from previous run is ignored
                return;
            }
            const sourceComponentId = context.signal.content.componentId;
            if (!sourceComponentId) {
                return;
            }
            await context.stateAddToSet('signalsArrived', sourceComponentId);
            const signalsArrived = await context.stateGet('signalsArrived');
            if (!Array.isArray(signalsArrived)) {
                await context.log({ error: 'Invalid signalsArrived array.', signalsArrived });
                return;
            }
            const expected = await context.flow.stateGet('signalReceivers');
            if (Array.isArray(expected)
                && expected.filter(item => !signalsArrived.includes(item.componentId)).length === 0) {
                await context.sendJson(
                    { now: Date.now(), runId: context.state.runId },
                    'out',
                    { scope: context.state.scope });
                await context.stateUnset('waitingForSync');
                await context.clearTimeout(context.state.timeoutId);
            }
        } finally {
            lock && lock.unlock();
        }
    },

    async receive(context) {

        const syncTimeout = context.config.syncTimeout || 60000;

        // only one message should arrive to the input port, message that triggers the test flow
        if (context.messages.timeout) {
            await context.log({ err: `AfterAll component did not respond within ${syncTimeout} ms.` });
            await context.stateClear();
            await context.flow.stateUnset(commons.STATE);
            return;
        }

        if (context.state.waitingForSync && (new Date() - new Date(context.state.waitingForSync) < syncTimeout)) {
            return;
        }

        const runId = uuid.v4();
        const now = new Date();

        await context.flow.stateSet('state', { started: now, runId });

        const timeoutId = await context.setTimeout({ runId }, syncTimeout);
        await context.saveState({ runId, timeoutId, waitingForSync: now, signalsArrived: [], scope: context.scope });
        // send a signal to the other Test components, so they can reset their state (CallCount, AfterAll)
        await context.sendSignal({ beforeAll: { now, runId } });
    }
};
