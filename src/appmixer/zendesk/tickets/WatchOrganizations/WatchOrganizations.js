'use strict';

const lib = require('../lib');

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
        return data.organization;
    },

    async fetchLatestOrganization(context) {

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/organizations.json`;
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
        return ((data && data.organizations) || [])[0] || null;
    },

    async test(context) {

        const organization = await this.fetchLatestOrganization(context);
        if (!organization) {
            throw new Error('No recent organizations to use as test data.');
        }

        const normalizedEventTypes = context.properties.eventTypes ?
            lib.normalizeMultiselectInput(context.properties.eventTypes, context, 'Event Types') : [];
        const eventType = normalizedEventTypes[0] || 'zen:event-type:organization.created';

        // Reconstruct the webhook payload shape `receive()` forwards as `data`.
        const data = {
            account_id: organization.account_id,
            id: String(organization.id),
            subject: `zen:organization:${organization.id}`,
            time: organization.updated_at || organization.created_at,
            type: eventType,
            zendesk_event_version: '2022-06-20',
            detail: {
                created_at: organization.created_at,
                id: String(organization.id),
                name: organization.name,
                shared_comments: organization.shared_comments,
                shared_tickets: organization.shared_tickets,
                group_id: organization.group_id != null ? String(organization.group_id) : null,
                external_id: organization.external_id,
                updated_at: organization.updated_at
            }
        };

        // Matches the `user` outPort field `receive()` populates with the organization record.
        return context.sendJson({ user: organization, data }, 'out');
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
