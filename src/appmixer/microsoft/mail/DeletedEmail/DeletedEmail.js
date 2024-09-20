'use strict';

const { makeRequest, renewBeforeExpirationMs } = require('../commons');

const clientState = 'appmixer.microsoft.mail';

const getSubscriptionExpirationDateTime = () => {
    // The maximum expiration date for Outlook message subscriptions is 4230 minutes (less than 3 days).
    // See https://docs.microsoft.com/en-us/graph/api/resources/subscription?view=graph-rest-1.0#maximum-length-of-subscription-per-resource-type.
    // We renew every 2 days to stay on the safe side.
    return new Date(Date.now() + 3000 * 60 * 1000);
};

module.exports = {

    async start(context) {

        const path = '/subscriptions';
        const expirationDateTime = getSubscriptionExpirationDateTime();
        const body = {
            changeType: 'deleted',
            notificationUrl: context.getWebhookUrl(),
            resource: context.properties.resource || "/me/mailfolders('inbox')/messages",
            expirationDateTime: expirationDateTime.toISOString(),
            clientState: clientState
        };

        await context.log({ step: 'Registering webhook subscription.', body: body });

        try {
            const { data } = await makeRequest(context, { path, method: 'POST', data: body });
            await context.saveState({ subscriptionId: data.id });
            // await context.log({ step: 'Response for subscription received.', data: data });
        } catch (err) {
            // await context.log({ error: err + '', response: err.response?.data });
            throw new Error(err);
        }

        // Fire a moment before expirationDateTime to ensure the subscription is renewed in time.
        return context.setTimeout({}, expirationDateTime - Date.now() - renewBeforeExpirationMs);
    },

    async stop(context) {

        const subscriptionId = context.state.subscriptionId;

        if (subscriptionId) {
            const path = `/subscriptions/${subscriptionId}`;

            return makeRequest(context, { path, method: 'DELETE' });

        }
    },

    async receive(context) {

        if (context.messages.timeout) {
            const subscriptionId = context.state.subscriptionId;
            // Periodically renew subscription.
            // await context.log({ step: 'Renewing notification subscription.', subscriptionId });
            const expirationDateTime = getSubscriptionExpirationDateTime();
            const body = { expirationDateTime: expirationDateTime.toISOString() };

            try {
                await makeRequest(context, { path: `/subscriptions/${subscriptionId}`, method: 'PATCH', data: body });
            } catch (err) {
                // await context.log({ error: 'Failed to renew subscription.', response: err.response?.data });
                throw new Error(err);
            }

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
                // await context.log({
                //     step: 'Webhook URL validation.',
                //     validationToken: query.validationToken,
                //     query: query
                // });
                return context.response(query.validationToken, 200, { 'Content-type': 'text/plain' });
            } else {
                const value = data.value || [];
                for (const notification of value) {
                    if (notification.clientState === clientState) {
                        const messageId = notification.resourceData.id;
                        try {
                            const messageResponse = await makeRequest(context, { path: `/me/messages/${messageId}`, method: 'GET' });
                            await context.sendJson(messageResponse.data, 'out');
                        } catch (err) {
                            // await context.log({ error: 'Failed to fetch message.', response: err.response?.data });
                            throw new Error(err);
                        }
                    }
                }
                return context.response('', 200);
            }
        }
    }
};
