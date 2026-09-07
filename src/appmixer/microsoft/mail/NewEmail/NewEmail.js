'use strict';

const commons = require('../commons');
const { makeRequest, renewBeforeExpirationMs } = commons;

const clientState = 'appmixer.microsoft.mail';

const getSubscriptionExpirationDateTime = () => {
    // The maximum expiration date for Outlook message subscriptions is 4230 minutes (less than 3 days).
    // See https://docs.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0#maximum-length-of-subscription-per-resource-type.
    // We renew every 2 days to stay on the safe side.
    return new Date(Date.now() + 3000 * 60 * 1000);
};

module.exports = {

    async start(context) {

        const expirationDateTime = getSubscriptionExpirationDateTime();
        const body = {
            changeType: 'created',
            notificationUrl: context.getWebhookUrl(),
            resource: context.properties.resource || "/me/mailfolders('inbox')/messages",
            expirationDateTime: expirationDateTime.toISOString(),
            clientState: clientState
        };

        // await context.log({ step: 'Registering webhook subscription.', body });

        const { data } = await makeRequest(context, {
            method: 'POST',
            path: '/subscriptions',
            data: body
        });
        await context.saveState({ subscriptionId: data.id });
        // await context.log({ step: 'Response for subscription received.', data });

        // Fire a moment before expirationDateTime to ensure the subscription is renewed in time.
        return context.setTimeout({}, expirationDateTime - Date.now() - renewBeforeExpirationMs);
    },

    async stop(context) {

        const subscriptionId = context.state.subscriptionId;

        if (subscriptionId) {
            await makeRequest(context, {
                method: 'DELETE',
                path: `/subscriptions/${subscriptionId}`
            });
        }
    },

    async receive(context) {

        if (context.messages.timeout) {

            const subscriptionId = context.state.subscriptionId;

            // Periodically renew subscription.
            // await context.log({ step: 'Renewing notification subscription.', subscriptionId });

            const expirationDateTime = getSubscriptionExpirationDateTime();
            const body = { expirationDateTime: expirationDateTime.toISOString() };

            await makeRequest(context, {
                method: 'PATCH',
                path: `/subscriptions/${subscriptionId}`,
                data: body
            });

            // await context.log({
            //     step: 'Notification subscription successfully renewed.',
            //     subscriptionId,
            //     expirationDateTime: expirationDateTime.toISOString()
            // });

            // Schedule another renewal.
            // Fire a moment before expirationDateTime to ensure the subscription is renewed in time.
            return context.setTimeout({}, expirationDateTime - Date.now() - renewBeforeExpirationMs);
        } else if (context.messages.webhook) {

            const { data, query } = context.messages.webhook.content;
            // await context.log({ step: 'Webhook received.', content: context.messages.webhook.content });

            if (query.validationToken) {

                // See https://docs.microsoft.com/en-us/graph/webhooks#notification-endpoint-validation.
                // await context.log({ step: 'Webhook URL validation.', validationToken: query.validationToken, query });
                return context.response(query.validationToken, 200, { 'Content-type': 'text/plain' });
            } else {
                const value = data.value || [];

                for (const notification of value) {
                    // Check if the client state is the one we expect. If not, it may be possible this change notification
                    // did not originate from MS Graph.
                    if (notification.clientState === clientState) {

                        // Download each message.
                        const requestOptions = {
                            method: 'GET',
                            path: `/me/messages/${notification.resourceData.id}`
                        };

                        const messageResponse = await makeRequest(context, requestOptions);
                        await context.sendJson(messageResponse.data, 'out');
                    }
                }

                return context.response('', 200);
            }
        }
    },

    async test(context) {

        // Flow Test Mode: no webhook fires, so list the watched folder newest-first
        // and emit the most recently received message. Same makeRequest path and
        // identical message shape `receive()` forwards (GET /me/messages/{id}).
        const message = await commons.fetchLatestMessage(context, 'receivedDateTime');
        if (!message) {
            throw new Error('No recent messages in the watched folder to use as test data.');
        }
        return context.sendJson(message, 'out');
    }
};
