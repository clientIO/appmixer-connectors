'use strict';

module.exports = {

    async start(context) {

        return context.saveState({ count: context.properties.count });
    },

    /**
     * @param {Context} context
     */
    async receive(context) {

        if (context.messages.reset) {
            let { count = context.properties.count } = context.messages?.reset?.content;
            await context.saveState({ count });
            return;
        }

        const newCount = await context.stateInc('count', context.properties.increment);
        return context.sendJson({ count: newCount }, 'count');
    }
};
