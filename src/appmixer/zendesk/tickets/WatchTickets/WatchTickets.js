'use strict';

module.exports = {

    async receive(context) {

        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            const ticketId = data.id;
            const ticket = await this.showTicket(context, ticketId);
            await context.sendJson({ ticket }, 'out');
            return context.response();
        }
    },

    async showTicket(context, ticketId) {

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/tickets/${ticketId}`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const req = {
            url: url,
            method: 'GET',
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        return data.ticket;
    },

    // Returns the latest ticket honoring the configured filter conditions, or null when none match.
    async fetchLatestTicket(context) {

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/tickets.json`;
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
                per_page: 25
            }
        };
        const { data } = await context.httpRequest(req);
        const tickets = (data && data.tickets) || [];

        const { typeCondition, statusCondition, priorityCondition } = context.properties;
        const matches = (ticket) => {
            const checkConditions = (condition, fieldValue) => {
                if (!condition || !Array.isArray(condition.ADD)) {
                    return true;
                }
                return condition.ADD.every((cond) => {
                    switch (cond.operator) {
                        case 'is':
                            return fieldValue === cond.value;
                        case 'is_not':
                            return fieldValue !== cond.value;
                        default:
                            // less_than / greater_than are not meaningfully comparable here, accept.
                            return true;
                    }
                });
            };
            return checkConditions(typeCondition, ticket.type)
                && checkConditions(statusCondition, ticket.status)
                && checkConditions(priorityCondition, ticket.priority);
        };

        return tickets.find(matches) || null;
    },

    async test(context) {

        const ticket = await this.fetchLatestTicket(context);
        if (!ticket) {
            throw new Error('No recent tickets to use as test data.');
        }
        return context.sendJson({ ticket }, 'out');
    },

    async createWebhook(context) {

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/webhooks`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const requestBody = {
            webhook: {
                endpoint: context.getWebhookUrl(),
                subscriptions: ['conditional_ticket_events'],
                http_method: 'POST',
                name: 'WatchTickets:webhook:' + context.componentId,
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

    async createTrigger(context, webhookId) {

        const conditions = {
            all: [],
            any: []
        };

        const { updateType, typeCondition, statusCondition, priorityCondition }  = context.properties;

        if (updateType) {
            conditions.all.push({
                field: 'update_type',
                value: updateType
            });
        }
        if (typeCondition) {
            typeCondition.ADD.forEach((cond) => {
                conditions.all.push({
                    field: 'type',
                    operator: cond.operator,
                    value: cond.value
                });
            });
        }
        if (statusCondition) {
            statusCondition.ADD.forEach((cond) => {
                conditions.all.push({
                    field: 'status',
                    operator: cond.operator,
                    value: cond.value
                });
            });
        }
        if (priorityCondition) {
            priorityCondition.ADD.forEach((cond) => {
                conditions.all.push({
                    field: 'status',
                    operator: cond.operator,
                    value: cond.value
                });
            });
        }

        const url = `https://${context.auth.subdomain}.zendesk.com/api/v2/triggers`;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        const requestBody = {
            trigger: {
                title: 'WatchTickets:trigger:' + context.componentId,
                active: true,
                actions: [
                    {
                        field: 'notification_webhook',
                        value: [
                            webhookId,
                            JSON.stringify({
                                id: '{{ticket.id}}'
                            })
                        ]
                    }
                ],
                conditions: conditions
            }
        };
        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
        };
        const { data } = await context.httpRequest(req);
        return data.trigger;
    },

    async start(context) {

        // Create a new webhook.
        const webhook = await this.createWebhook(context);
        await context.log({ step: 'webhook-created', webhook });
        const trigger = await this.createTrigger(context, webhook.id);
        await context.log({ step: 'trigger-created', trigger });
        return context.saveState({ webhook, trigger });
    },

    async stop(context) {

        const webhookId = context.state.webhook.id;
        const triggerId = context.state.trigger.id;
        const headers = {
            Authorization: 'Bearer ' + context.auth.accessToken
        };
        await context.httpRequest({
            url: `https://${context.auth.subdomain}.zendesk.com/api/v2/webhooks/${webhookId}`,
            method: 'DELETE',
            headers: headers
        });
        await context.httpRequest({
            url: `https://${context.auth.subdomain}.zendesk.com/api/v2/triggers/${triggerId}`,
            method: 'DELETE',
            headers: headers
        });
    }
};
