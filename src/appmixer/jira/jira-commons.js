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

    // Fetch the single newest issue (sorted by `created`/`updated` desc), honoring an
    // optional project filter. Shared by the issue triggers' test() (Flow Test Mode):
    // it reuses the same search request + fields tick() uses, but without the
    // `created/updated > now` baseline that suppresses output on a fresh flow.
    async fetchLatestIssue(context, { project, orderBy = 'created' } = {}) {

        const { profileInfo: { apiUrl }, auth } = context;
        let jql = project ? `project = "${project}" ` : '';
        jql += `ORDER BY ${orderBy} DESC`;

        const issues = await this.getAPINoPagination({
            endpoint: `${apiUrl}search/jql`,
            credentials: auth,
            key: 'issues',
            params: { maxResults: 1, jql, fields: '*navigable' }
        });
        return (Array.isArray(issues) ? issues : [])[0] || null;
    },

    // Fetch one project via the same project/search request the project triggers use.
    async fetchLatestProject(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const projects = await this.pager({
            endpoint: `${apiUrl}project/search`,
            credentials: auth,
            key: 'values',
            params: { maxResults: 100 }
        });
        return (Array.isArray(projects) ? projects : [])[0] || null;
    },

    // The webhook triggers' receive() emits data[key] with a `webhookEvent` field
    // added (see executeWebhookRequest); their test() reshapes a REST record the
    // same way.
    toWebhookShape(record, webhookEvent) {

        return { ...record, webhookEvent };
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
    toInspector(fields, excludeFields, starIndex = 1) {

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
            if (excludeFields.includes(key)) {
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
                index: index + starIndex
            };

            if (Array.isArray(allowedValues)) {
                inspector.inputs[key].type = 'select';
                inspector.inputs[key].options = allowedValues.map(v => ({
                    content: v.name || v.value || v.id,
                    value: v.id
                }));
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

            if (schema.type === 'date' || schema.type === 'datetime') {
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

    formatCustomFields(issueInfo, fieldMeta) {

        Object.keys(issueInfo).forEach(key => {
            if (!key.startsWith('customfield_')) return;

            const value = issueInfo[key];
            if (value === undefined || value === null || value === '') {
                delete issueInfo[key];
                return;
            }

            const meta = fieldMeta[key];
            if (!meta || !meta.schema) return;

            const { schema } = meta;
            const hasAllowedValues = Array.isArray(meta.allowedValues) && meta.allowedValues.length > 0;

            if (schema.type === 'array') {
                if (Array.isArray(value)) {
                    if (schema.items === 'option' || (hasAllowedValues && schema.items !== 'string')) {
                        issueInfo[key] = value.map(v => ({ id: v }));
                    }
                }
            } else if (schema.type === 'option' || schema.type === 'user' || hasAllowedValues) {
                issueInfo[key] = { id: value };
            } else if (schema.type === 'number') {
                issueInfo[key] = Number(value);
            }
        });
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
