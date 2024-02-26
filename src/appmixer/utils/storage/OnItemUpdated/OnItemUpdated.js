'use strict';

module.exports = {

    async receive(context) {

        const data = context.messages.webhook.content.data.currentValue;

        if (context.messages.webhook.content.data.type === 'update') {
            await context.sendJson({
                key: data.key,
                storeId: data.storeId,
                value: data.value,
                oldValue: data.oldValue,
                updatedAt: data.updatedAt,
                createdAt: data.createdAt
            }, 'item');
        }
        return context.response('ok');
    },

    async start(context) {

        await context.store.registerWebhook(context.properties.storeId);
    },

    async stop(context) {

        await context.store.unregisterWebhook(context.properties.storeId);
    }
};
