'use strict';

module.exports = {

    /**
     * Get request for calendly.
     * @param {Context} context
     * @param {string} event - should be one of ['invitee.created', 'invitee.canceled', 'invitee_no_show.created', 'invitee_no_show.deleted']

     * @returns {*}
     */
    async registerWebhookSubscription(context, event) {
        const { accessToken, profileInfo: { resource } } = context.auth;
        const url = context.getWebhookUrl();

        try {
            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.calendly.com/webhook_subscriptions',
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                },
                data: {
                    url,
                    events: [event],
                    scope: 'user',
                    user: resource.uri,
                    organization: resource.current_organization
                }
            });
            context.log({ step: 'registerWebhookSubscription', data });
            return data.resource;
        } catch (error) {
            if (error.response && error.response.status === 409) {
                const options = {
                    method: 'GET',
                    url: 'https://api.calendly.com/webhook_subscriptions',
                    headers: { 'Authorization': `Bearer ${accessToken}` },
                    params: {
                        organization: resource.current_organization,
                        scope: 'user',
                        user: resource.uri
                    }
                };
                const listResponse = await context.httpRequest(options);

                const existing = listResponse.data.collection.find(
                    sub => sub.callback_url === url && sub.events.includes(event)
                );

                if (existing) {
                    context.log({ step: 'registerWebhookSubscription (fetched existing)', data: existing });
                    return { uri: existing.uri };
                }

                // If no matching webhook found, throw the original error
                throw error;
            }
        }
    },

    /**
     * Fetch the most recent invitee for the authenticated user via the REST API.
     * Used by the webhook triggers' test() methods (Flow Test Mode) to produce a realistic
     * example without registering a webhook. Read-only, touches no state. Returns null if no
     * matching invitee exists.
     * @param {Context} context
     * @param {object} [options]
     * @param {string} [options.status] - invitee status filter (e.g. 'canceled')
     * @param {function} [options.find] - predicate to pick a specific invitee (e.g. has no_show)
     * @returns {Promise<object|null>} raw Calendly invitee resource
     */
    async fetchLatestExample(context, { status, find } = {}) {
        const { accessToken, profileInfo: { resource } } = context.auth;
        const headers = { 'Authorization': `Bearer ${accessToken}` };

        // When filtering (canceled / no-show), the newest event may not contain a match —
        // scan a few recent events. Plain newest-invitee lookups stay at a single event.
        const eventsResponse = await context.httpRequest({
            method: 'GET',
            url: 'https://api.calendly.com/scheduled_events',
            headers,
            params: { user: resource.uri, sort: 'start_time:desc', count: (status || find) ? 10 : 1 }
        });
        const events = eventsResponse.data.collection || [];

        for (const event of events) {
            const inviteesResponse = await context.httpRequest({
                method: 'GET',
                url: `${event.uri}/invitees`,
                headers,
                params: Object.assign(
                    { count: find ? 100 : 1, sort: 'created_at:desc' },
                    status ? { status } : {}
                )
            });
            const invitees = inviteesResponse.data.collection || [];
            const match = find ? invitees.find(find) : invitees[0];
            if (match) {
                return match;
            }
        }
        return null;
    },

    /**
     * Reshape a REST invitee resource into the exact body Calendly delivers to the webhook —
     * the shape the triggers' receive() forwards on the 'out' port. Single source of truth for
     * the webhook payload shape, shared by every Calendly webhook trigger's test().
     * @param {Context} context
     * @param {object} invitee - raw invitee resource from fetchLatestExample()
     * @param {string} event - e.g. 'invitee.created'
     * @returns {object}
     */
    toWebhookShape(context, invitee, event) {
        return {
            created_at: invitee.created_at,
            created_by: context.auth.profileInfo.resource.uri,
            event,
            payload: invitee
        };
    },

    /**
     * Reshape an invitee that was marked as a no-show into the body Calendly delivers for
     * invitee_no_show.* webhooks — the payload there is the no-show resource, not the invitee.
     * The invitee must have its `no_show` field set.
     * @param {Context} context
     * @param {object} invitee - raw invitee resource with `no_show` set
     * @param {string} event - 'invitee_no_show.created' or 'invitee_no_show.deleted'
     * @returns {object}
     */
    toNoShowWebhookShape(context, invitee, event) {
        return {
            created_at: invitee.no_show.created_at,
            created_by: context.auth.profileInfo.resource.uri,
            event,
            payload: {
                uri: invitee.no_show.uri,
                invitee: invitee.uri,
                created_at: invitee.no_show.created_at
            }
        };
    },

    /**
     * DELETE request for calendly to remove webhook subscription.
     * @param {string} webhookUri
     * @param {Context} context
     * @returns {*}
     */
    async removeWebhookSubscription(webhookUri, context) {
        const { accessToken } = context.auth;

        await context.httpRequest({
            method: 'DELETE',
            url: webhookUri,
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });
    }
};
