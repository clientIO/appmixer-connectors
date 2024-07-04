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
        return context.stateSet('connectionId', connectionId);
    },

    async stop(context) {

        const connectionId = await context.stateGet('connectionId');
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

        let connectionId = await context.stateGet('connectionId');

        if (!connectionId) {

            await context.log({ step: 'connecting', message: 'Connection to Kafka not yet established. Waiting for connectionId.' });
            // It might have happened that the connectionId was not yet stored to the state in the start() method.
            // This can occur if another component sent a message to our SendMessage before our start() method finished.
            // See e.g. the implementation of OnStart (https://github.com/clientIO/appmixer-connectors/blob/dev/src/appmixer/utils/controls/OnStart/OnStart.js).
            const checkStartTime = new Date;
            const maxWaitTime = 10000;  // 10 seconds
            await new Promise((resolve, reject) => {
                const intervalId = setInterval(async () => {
                    connectionId = await context.stateGet('connectionId');
                    if (connectionId) {
                        clearInterval(intervalId);
                        await context.log({ step: 'connected', message: 'Connection to Kafka established.' });
                        resolve();
                    } else if (new Date - checkStartTime > maxWaitTime) {
                        clearInterval(intervalId);
                        reject(new Error('Connection not established.'));
                    }
                }, 500);
            });
        }

        await context.callAppmixer({
            endPoint: `/plugins/appmixer/kafka/producers/${connectionId}/send`,
            method: 'POST',
            body: payload
        });

        return context.sendJson(context.messages.in.content, 'out');
    }
};
