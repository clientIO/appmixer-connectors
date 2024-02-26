'use strict';

module.exports = {

    async start(context) {

        // let's send message to output right after flow has been started, this way
        // users don't have to wait 5 (at least) minutes for the first message to test
        // their flow
        const now = Date.now();
        await context.sendJson({ now: new Date(now).toISOString() }, 'out');

        // start ticking
        return context.setTimeout({ lastTick: now }, context.properties.interval * 60 * 1000);
    },

    async receive(context) {

        if (context.messages.timeout) {

            let lock;
            try {
                lock = await context.lock(context.componentId);

                const { state, timeoutId } = await context.loadState();
                if (timeoutId && context.messages.timeout.timeoutId !== timeoutId) {
                    // handling the case, when timeout has been set, but system crashed, and the timeoutId
                    // has not been saved into state, then the `original` timeout has been triggered again(
                    // because it did not finish correctly), state was 'JsonSent' and timeout was set
                    // for the second time. At this point, two timeouts can be in the DB, but we have
                    // to process only one, let's process the one with the same timeoutId as in the 'state'
                    return;
                }

                const lastTick = context.messages.timeout.content.lastTick;
                const now = Date.now();

                switch (state) {
                    case undefined:     // init, called for the first time
                    case 'timeoutSet':
                        await context.stateSet('state', 'sendingJson');
                        // if the system crashed not, the timeout will be re-delivered into `receive()` method,
                        // the state will be `sendingJson` and now, we need to send json to output port

                    case 'sendingJson':
                        // if previous timeout crashed while sending json to the output port, we don't know if the
                        // json was sent, or not, better to send it twice, than none
                        // send tick data
                        await context.sendJson({
                            lastTick: new Date(lastTick).toISOString(),
                            now: new Date(now).toISOString(),
                            elapsed: now - lastTick
                        }, 'out');
                        await context.stateSet('state', 'JsonSent');
                        // state has changed to 'JsonSent', if it crashes at this point, the timeout will be retried,
                        // but the JSON won't be sent again to the output port, instead we will create the followup
                        // timeout

                    case 'JsonSent':
                        // keep ticking
                        const newTimeoutId = await context.setTimeout(
                            { lastTick: now }, context.properties.interval * 60 * 1000);
                        // the system can crash at this point, timeout is set, but that information won't be stored
                        // in the 'state' and the system will trigger the 'receive()' with the original timeout again,
                        // such case is handled in the "case 'timeoutSet':", see above
                        await context.saveState({ state: 'timeoutSet', timeoutId: newTimeoutId });
                }
            } finally {
                if (lock) {
                    await lock.unlock();
                }
            }
        }
    }
};

