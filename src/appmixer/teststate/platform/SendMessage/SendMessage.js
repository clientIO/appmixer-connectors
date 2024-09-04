'use strict';

module.exports = {

    async start(context) {

        const state = Math.random().toString(36).substring(7);

        await context.log({ step: 'sendMessage.start', state });

        await new Promise((resolve, reject) => {
            setTimeout(() => {
                resolve();
            }, 2000);
        });

        await context.stateSet('state', state);
    },

    async stop(context) {

        const state = await context.stateGet('state');
        await context.log({ step: 'sendMessage.stop', state });
    },

    async receive(context) {

        const state = await context.stateGet('state');
        await context.log({ step: 'sendMessage.receive', state });
        return context.sendJson(context.messages.in.content, 'out');
    }
};
