'use strict';

module.exports = {

    async start(context) {

        const {
            componentId,
            flowId,
            properties: { queue, consumerTag, noAck = false, exclusive = false, priority }
        } = context;
        const { channelId } = await context.callAppmixer({
            endPoint: '/plugins/appmixer/rabbitmq/consumers',
            method: 'POST',
            body: {
                auth: context.auth,
                queue,
                options: {
                    consumerTag,
                    noAck,
                    exclusive,
                    priority
                },
                componentId,
                flowId
            }
        });
        return context.stateSet('channelId', channelId);
    },

    async stop(context) {

        const channelId = await context.stateGet('channelId');
        return context.callAppmixer({
            endPoint: `/plugins/appmixer/rabbitmq/consumers/${channelId}`,
            method: 'DELETE'
        });
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
            return context.response({});
        }
    }
};
