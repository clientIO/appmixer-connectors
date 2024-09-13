'use strict';

module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            await context.log({ step: 'webhook-received', data });
            const userId = data.detail.id;
            const user = await this.showUser(context, userId);
            await context.sendJson({ user }, 'out');
            return context.response();
        }
    },

    async showUser(context, userId) {

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/users/${userId}`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const req = {
            url: url,
            method: 'GET',
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        return data.user;
    },

    async createWebhook(context) {
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/webhooks`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const requestBody = {
            webhook: {
                endpoint: context.getWebhookUrl(),
                subscriptions: context.properties.eventTypes,
                http_method: 'POST',
                name: 'WatchUsers:webhook:' + context.componentId,
                request_format: 'json',
                status: 'active'
            }
        };
        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        return data.webhook;
    },

    async start(context) {

        // Create a new webhook.
        const webhook = await this.createWebhook(context);
        await context.log({ step: 'webhook-created', webhook });
        return context.saveState({ webhook });
    },

    async stop(context) {

        const webhookId = context.state.webhook.id;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        await context.httpRequest({
            url: `https://${context.auth.subdomain}.zendesk.com/api/v2/webhooks/${webhookId}`,
            method: 'DELETE',
            headers: headers
        });
    }
};
