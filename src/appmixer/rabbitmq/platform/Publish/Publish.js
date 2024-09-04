'use strict';

module.exports = {

    async start(context) {

        const { flowId, componentId, auth } = context;
        const { channelId } = await context.callAppmixer({
            endPoint: '/plugins/appmixer/rabbitmq/producers',
            method: 'POST',
            body: {
                flowId,
                componentId,
                auth
            }
        });
        return context.stateSet('channelId', channelId);
    },

    async stop(context) {

        const channelId = await context.stateGet('channelId');
        return context.callAppmixer({
            endPoint: `/plugins/appmixer/rabbitmq/producers/${channelId}`,
            method: 'DELETE'
        });
    },

    async receive(context) {

        const {
            exchange,
            routingKey,
            message
        } = context.messages.in.content;

        const payload = {
            exchange,
            routingKey,
            message
        };

        let channelId = await context.stateGet('channelId');

        if (!channelId) {

            await context.log({ step: 'connecting', message: 'Connection to RabbitMQ not yet established. Waiting for channelId.' });
            // It might have happened that the connectionId was not yet stored to the state in the start() method.
            // This can occur if another component sent a message to our Publish before our start() method finished.
            // See e.g. the implementation of OnStart (https://github.com/clientIO/appmixer-connectors/blob/dev/src/appmixer/utils/controls/OnStart/OnStart.js).
            const checkStartTime = new Date;
            const maxWaitTime = 10000;  // 10 seconds
            await new Promise((resolve, reject) => {
                const intervalId = setInterval(async () => {
                    channelId = await context.stateGet('channelId');
                    if (channelId) {
                        clearInterval(intervalId);
                        await context.log({ step: 'connected', message: 'Connection to RabbitMQ established.' });
                        resolve();
                    } else if (new Date - checkStartTime > maxWaitTime) {
                        clearInterval(intervalId);
                        reject(new Error('Connection not established.'));
                    }
                }, 500);
            });
        }

        await context.callAppmixer({
            endPoint: `/plugins/appmixer/rabbitmq/producers/${channelId}/publish`,
            method: 'POST',
            body: payload
        });

        return context.sendJson(context.messages.in.content, 'out');
    }
};
