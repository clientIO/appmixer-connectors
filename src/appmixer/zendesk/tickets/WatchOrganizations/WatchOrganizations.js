'use strict';

module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            await context.log({ step: 'webhook-received', data });
            const orgId = data.detail.id;
            const user = await this.showOrganization(context, orgId);
            await context.sendJson({ user, data }, 'out');
            return context.response();
        }
    },

    async showOrganization(context, orgId) {

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/organizations/${orgId}`;
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
                name: 'WatchOrganizations:webhook:' + context.componentId,
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
