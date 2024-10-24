'use strict';

const request = require('request-promise');

const EventType = {
    issueCreated: 'jira:issue_created',
    issueUpdated: 'jira:issue_updated',
    issueDeleted: 'jira:issue_deleted',
    projectCreated: 'project_created',
    projectUpdated: 'project_updated',
    projectDeleted: 'project_deleted'
};

module.exports = {

    request(endpoint, method, credentials, qs, body) {

        return request({
            method,
            url: endpoint,
            auth: { bearer: credentials.accessToken },
            qs,
            json: true,
            body,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
    },

    post(endpoint, credentials, body) {

        return this.request(endpoint, 'POST', credentials, undefined, body);
    },

    put(endpoint, credentials, body) {

        return this.request(endpoint, 'PUT', credentials, undefined, body);
    },

    get(endpoint, credentials, qs) {

        return this.request(endpoint, 'GET', credentials, qs);
    },

    delete(endpoint, credentials, body) {

        return this.request(endpoint, 'DELETE', credentials, undefined, body);
    },

    async getAPINoPagination({ endpoint, credentials, key, params = {} }) {
        const currentPage = await this.get(endpoint, credentials, params);

        return currentPage[key];
    },

    async pager({ endpoint, credentials, key, params = {} }) {

        const currentPage = await this.get(endpoint, credentials, params);
        if (
            currentPage[key].length === 0 ||
            currentPage[key].length < (params.maxResults || 500)
        ) {
            return currentPage[key];
        }

        params = Object.assign({}, params, { startAt: (params.startAt || 0) + params.maxResults });
        const nextPage = await this.pager({
            endpoint,
            credentials,
            key,
            params
        });
        return currentPage[key].concat(nextPage);
    },

    /**
     * Process items to find newly added.
     * @param {Set} knownItems
     * @param {Set} actualItems
     * @param {Set} newItems
     * @param {Object} item
     */
    processItems(knownItems, actualItems, newItems, item) {

        if (knownItems && !knownItems.has(item['id'])) {
            newItems.add(item);
        }
        actualItems.add(item['id']);
    },

    buildDocType(data) {

        return {
            type: 'doc',
            version: 1,
            content: [{
                type: 'paragraph',
                content: [{
                    type: 'text',
                    text: data
                }]
            }]
        };
    },

    // See IssueMetadata.js
    toInspector(fields, excludeFields) {

        const inspector = {
            schema: {
                type: 'object',
                properties: {},
                required: []
            },
            inputs: {
            }
        };

        Object.keys(fields).forEach((key, index) => {
            if (excludeFields.includes(key) || key.includes('customfield_')) {
                return;
            }

            const { name, schema, required, allowedValues, autoCompleteUrl } = fields[key];
            inspector.schema.properties[key] = {
                type: 'string'
            };

            if (required) {
                inspector.schema.required.push(key);
            }

            inspector.inputs[key] = {
                label: name,
                type: 'text',
                index: index + 1
            };

            if (Array.isArray(allowedValues)) {
                inspector.inputs[key].type = 'select';
                inspector.inputs[key].options = allowedValues.map(value => ({ content: value.name, value: value.id }));
            }

            if (schema.type === 'array') {
                inspector.schema.properties[key] = {
                    type: 'array',
                    items: {
                        type: 'string'
                    }
                };

                inspector.inputs[key].type = 'multiselect';
            }

            if (schema.type === 'date') {
                inspector.inputs[key].type = 'date-time';
            }

            if (autoCompleteUrl) {
                inspector.inputs[key].source = {
                    url: '/component/appmixer/jira/issues/ListField?outPort=out',
                    data: {
                        messages: { in: { 'endpoint': autoCompleteUrl } },
                        transform: './ListField#fieldToSelectArray'
                    }
                };
            }
        });

        return inspector;
    },

    async executeWebhookRequest(context, options) {

        const { port, key, eventType } = options;
        const { headers, data } = context.messages.webhook.content;
        let { webhookEvent } = data;

        const payload = data[key];
        payload.webhookEvent = webhookEvent;

        const identifier = headers['x-atlassian-webhook-identifier'];

        const storedIdentifier = await context.stateGet(`webhook-identifier-${identifier}`);

        if (storedIdentifier || eventType !== webhookEvent) {
            return context.response();
        }

        await context.sendJson(payload, port);

        await context.stateSet(`webhook-identifier-${identifier}`, new Date().toISOString());
    },

    generateWebhookInspector(context, port) {

        return context.sendJson({
            inputs: {
                url: {
                    label: 'Webhook URL',
                    type: 'text',
                    readonly: true,
                    defaultValue: context.getWebhookUrl(),
                    tooltip: `
                        Go to the Webhooks in Jira settings, create a Webhook and paste the Webhook URL in the URL field.
                    `
                }
            }
        }, port);
    },

    EventType
};
