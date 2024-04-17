// NewMessage.js
'use strict';

module.exports = {

    start(context) {

        const { componentId, flowId, properties: { topics, groupId, fromBeginning } } = context;
        return context.callAppmixer({
            endPoint: '/plugins/appmixer/kafka/connect/consumer',
            method: 'POST',
            body: {
                authDetails: context.auth,
                groupId: groupId || `group-${componentId}:${flowId}`,
                topics,
                fromBeginning,
                componentId,
                flowId
            }
        });
    },

    stop(context) {

        return context.callAppmixer({
            endPoint: `/plugins/appmixer/kafka/connect/consumer/${context.flowId}/${context.componentId}`,
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
