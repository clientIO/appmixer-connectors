'use strict';

const commons = require('../commons');
const { makeRequest, renewBeforeExpirationMs, getSubscriptionExpirationDateTime } = commons;

const clientState = 'appmixer.microsoft.calendar';

module.exports = {

    async start(context) {

        const expirationDateTime = getSubscriptionExpirationDateTime();
        const body = {
            changeType: 'created',
            notificationUrl: context.getWebhookUrl(),
            resource: context.properties.resource || '/me/events',
            expirationDateTime: expirationDateTime.toISOString(),
            clientState
        };

        const { data } = await makeRequest(context, {
            method: 'POST',
            path: '/subscriptions',
            data: body
        });
        await context.saveState({ subscriptionId: data.id });

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
            const expirationDateTime = getSubscriptionExpirationDateTime();
            const body = { expirationDateTime: expirationDateTime.toISOString() };

            await makeRequest(context, {
                method: 'PATCH',
                path: `/subscriptions/${subscriptionId}`,
                data: body
            });

            // Schedule another renewal a moment before expirationDateTime.
            return context.setTimeout({}, expirationDateTime - Date.now() - renewBeforeExpirationMs);
        } else if (context.messages.webhook) {

            const { data, query } = context.messages.webhook.content;

            if (query.validationToken) {
                // See https://docs.microsoft.com/en-us/graph/webhooks#notification-endpoint-validation.
                return context.response(query.validationToken, 200, { 'Content-type': 'text/plain' });
            }

            const value = data.value || [];

            for (const notification of value) {
                // Check if the client state is the one we expect. If not, it may be possible this change notification
                // did not originate from MS Graph.
                if (notification.clientState === clientState) {
                    let eventResponse;
                    try {
                        eventResponse = await makeRequest(context, {
                            method: 'GET',
                            path: `/me/events/${notification.resourceData.id}`
                        });
                    } catch (err) {
                        // Notifications can arrive minutes after the change — the event may have
                        // been deleted meanwhile. Skip it instead of failing the whole trigger.
                        if (err.response?.status === 404) continue;
                        throw err;
                    }
                    await context.sendJson(eventResponse.data, 'out');
                }
            }

            return context.response('', 200);
        }
    },

    async test(context) {

        // Flow Test Mode: no webhook fires, so list the calendar ordered by creation time
        // and emit the most recently created event. Same makeRequest path and identical
        // event shape `receive()` forwards (GET /me/events/{id}).
        const event = await commons.fetchLatestEvent(context, 'createdDateTime');
        if (!event) {
            throw new Error('No recent events in the calendar to use as test data.');
        }
        return context.sendJson(event, 'out');
    }
};
