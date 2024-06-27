'use strict';

const connections = require('../../connections');

module.exports = {

    start(context) {

        const { componentId, flowId, properties: { topics, groupId, fromBeginning } } = context;
        return context.callAppmixer({
            endPoint: '/plugins/appmixer/kafkadavid/consumers',
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
    },

    stop(context) {

        return context.callAppmixer({
            endPoint: `/plugins/appmixer/kafkadavid/consumers/${context.flowId}/${context.componentId}`,
            method: 'DELETE'
        });
    },

    async receive(context) {

        if (context.messages.webhook) {


            await context.log({ step: 'STEP_NewMessage', openConnections: Object.keys(connections.listConnections()) });

            const data = context.messages.webhook.content.data;

            data.gridInstanceId = context.gridInstanceId;

            await context.sendJson(data, 'out');
            return context.response({});
        }
    }
};
