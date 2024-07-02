'use strict';

module.exports = {

    async start(context) {

        const { flowId, componentId, auth } = context;
        const { connectionId } = await context.callAppmixer({
            endPoint: '/plugins/appmixer/kafka/producers',
            method: 'POST',
            body: {
                flowId,
                componentId,
                auth
            }
        });

        await context.log({ step: 'sendMessage.start', connectionId });

        await context.stateSet('connectionId', connectionId);
    },

    async stop(context) {

        const connectionId = await context.stateGet('connectionId');

        await context.log({ step: 'sendMessage.stop', connectionId });

        return context.callAppmixer({
            endPoint: `/plugins/appmixer/kafka/producers/${connectionId}`,
            method: 'DELETE'
        });
    },

    async receive(context) {

        const {
            topic,
            key,
            value,
            acks,
            timeout,
            partition,
            timestamp,
            headers
        } = context.messages.in.content;

        const message = {
            value,
            partition,
            timestamp: timestamp && new Date(timestamp).getTime(),
            headers: headers && JSON.parse(headers)
        };

        if (key) {
            message.key = key;
        }

        const payload = {
            topic,
            messages: [message],
            acks,
            timeout
        };

        const connectionId = await context.stateGet('connectionId');

        await context.log({ step: 'sendMessage.receive', connectionId, key, value });

        await context.callAppmixer({

            endPoint: `/plugins/appmixer/kafka/producers/${connectionId}/send`,
            method: 'POST',
            body: payload
        });

        return context.sendJson(context.messages.in.content, 'out');
    }
};
