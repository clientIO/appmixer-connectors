'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            await context.log({ step: 'webhook-received', data });
            const userId = data.detail.id;
            const user = await this.showUser(context, userId);
            await context.sendJson({ user, data }, 'out');
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

    async fetchLatestUser(context) {

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/users.json`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const req = {
            url: url,
            method: 'GET',
            headers: headers,
            params: {
                sort_by: 'created_at',
                sort_order: 'desc',
                per_page: 1
            }
        };
        const { data } = await context.httpRequest(req);
        return ((data && data.users) || [])[0] || null;
    },

    async test(context) {

        // Reuse the production lookup to guarantee identical `user` shape.
        const latest = await this.fetchLatestUser(context);
        if (!latest) {
            throw new Error('No recent users to use as test data.');
        }
        const user = await this.showUser(context, latest.id);

        const normalizedEventTypes = context.properties.eventTypes ?
            lib.normalizeMultiselectInput(context.properties.eventTypes, context, 'Event Types') : [];
        const eventType = normalizedEventTypes[0] || 'zen:event-type:user.created';

        // Reconstruct the webhook payload shape `receive()` forwards as `data`.
        const data = {
            account_id: user.account_id,
            id: String(user.id),
            subject: `zen:user:${user.id}`,
            time: user.updated_at || user.created_at,
            type: eventType,
            zendesk_event_version: '2022-06-20',
            detail: {
                created_at: user.created_at,
                email: user.email,
                id: user.id,
                external_id: user.external_id,
                default_group_id: user.default_group_id,
                organization_id: user.organization_id,
                role: user.role,
                updated_at: user.updated_at
            }
        };

        return context.sendJson({ user, data }, 'out');
    },

    async createWebhook(context) {
        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/webhooks`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };

        // Normalize multiselect input for eventTypes
        const normalizedEventTypes = context.properties.eventTypes ?
            lib.normalizeMultiselectInput(context.properties.eventTypes, context, 'Event Types') : [];

        const requestBody = {
            webhook: {
                endpoint: context.getWebhookUrl(),
                subscriptions: normalizedEventTypes,
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
