'use strict';

module.exports = {

    async start(context) {

        const { componentId, flowId, properties: { topics, groupId, fromBeginning } } = context;
        const { connectionId } = await context.callAppmixer({
            endPoint: '/plugins/appmixer/kafka/consumers',
            method: 'POST',
            body: {
                auth: context.auth,
                groupId: groupId || `group-${componentId}:${flowId}`,
                topics,
                fromBeginning,
                componentId,
                flowId
            }
        });
        return context.stateSet('connectionId', connectionId);
    },

    async stop(context) {

        const connectionId = await context.stateGet('connectionId');
        return context.callAppmixer({
            endPoint: `/plugins/appmixer/kafka/consumers/${connectionId}`,
            method: 'DELETE'
        });
    },

    async receive(context) {

        if (context.messages.webhook) {
            await context.sendJson(context.messages.webhook.content.data, 'out');
        }
    }
};
