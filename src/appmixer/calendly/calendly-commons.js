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
        context.log({ step: 'registerWebhookSubscription webhookUrl', url });

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.calendly.com/webhook_subscriptions',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            },
            data: {
                url: url,
                events: [event],
                scope: 'user',
                user: resource.uri,
                organization: resource.current_organization
            }
        });
        context.log({ step: 'registerWebhookSubscription response', data });
        return data.resource;
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
