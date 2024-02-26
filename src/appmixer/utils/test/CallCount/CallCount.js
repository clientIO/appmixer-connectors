'use strict';
const commons = require('../commons');

module.exports = {

    async signal(context) {

        // signal has to be sent before the test start, this is done
        // through BeforeAll component.
        // there are other signal, every 'trigger' components send 'tick' signals,
        // we want to ignore those and wait for the one from BeforeAll component
        if (context.signal.content.beforeAll) {
            await context.stateClear();
            await context.sendSignal({
                componentId: context.componentId,
                componentType: context.type,
                runId: context.signal.content.beforeAll.runId
            });
        }
    },

    async start(context) {

        return commons.registerSignalReceiver(context);
    },

    async receive(context) {

        let lock = null;
        try {
            lock = await context.lock(context.flowId);
            let { callCount = 0, messages = [] } = await context.loadState();
            messages.push(context.messages.in.originalContent);

            if (++callCount === context.messages.in.content.callCount) {
                await context.sendJson(messages || [], 'out');
                await context.saveState({ callCount });
                return;
            }

            await context.saveState({ callCount, messages });
        } finally {
            if (lock) {
                await lock.unlock();
            }
        }
    }
};
