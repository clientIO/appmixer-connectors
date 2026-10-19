'use strict';

// Shopify GraphQL Admin API accessed directly through context.httpRequest — no
// third-party client. This module provides:
//   - a throttled, 429-aware request layer and graphql()/runner() on top of it,
//   - the outputType helpers (sendArrayOutput, getOutputPortOptions),
//   - ShopifyQL reports,
//   - webhook registration and the webhook-to-trigger helper.
// Resource queries live in gql-*.js; objects are emitted as GraphQL returns them.

const pathModule = require('path');
const graphqlClient = require('./graphql-client');

const DEFAULT_API_VERSION = graphqlClient.API_VERSION;
const MIN_REQUEST_INTERVAL_MS = 500; // ~2 requests/second
const MAX_429_RETRIES = 4;
const DEFAULT_EXPORT_PREFIX = 'shopify-objects-export';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// Serialize every Shopify call through a single chain with a minimum spacing so
// we stay under the leaky-bucket limit without a dependency.
let requestChain = Promise.resolve();
let lastRequestAt = 0;

function schedule(task) {

    const run = async () => {
        const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - (Date.now() - lastRequestAt));
        if (wait > 0) {
            await sleep(wait);
        }
        lastRequestAt = Date.now();
        return task();
    };

    requestChain = requestChain.then(run, run);
    return requestChain;
}

// The store handle is the only part of the request host that comes from user
// input, and both the access token and the app's client secret are sent to that
// host — so anything but a plain myshopify.com handle is rejected.
const STORE_HANDLE_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

function normalizeStore(store) {

    const handle = String(store || '').trim().replace(/\.myshopify\.com$/i, '');
    if (!STORE_HANDLE_PATTERN.test(handle)) {
        throw new Error('Invalid Shopify store address. Enter the store name only, without .myshopify.com.');
    }
    return handle.toLowerCase();
}

function baseUrl(auth, apiVersion) {

    return `https://${normalizeStore(auth.store)}.myshopify.com/admin/api/${apiVersion || DEFAULT_API_VERSION}`;
}

// Low-level request with throttling and 429 (Retry-After) handling. Returns the
// parsed body plus the response headers (needed for pagination).
async function shopifyRequest(context, { method = 'GET', path, query, body, apiVersion }) {

    // In component contexts the credentials live on context.auth; in the auth
    // module (validate/requestProfileInfo) they are on the context itself.
    const auth = context.auth || context;
    const url = `${baseUrl(auth, apiVersion)}/${path}`;
    const options = {
        method,
        url,
        headers: {
            'X-Shopify-Access-Token': auth.accessToken,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
    };
    if (query && Object.keys(query).length) {
        options.params = query;
    }
    if (body !== undefined) {
        options.data = body;
    }

    for (let attempt = 0; ; attempt++) {
        try {
            const response = await schedule(() => context.httpRequest(options));
            return { data: response.data, headers: response.headers || {} };
        } catch (error) {
            const status = error.response && error.response.status;
            if (status === 429 && attempt < MAX_429_RETRIES) {
                const retryAfter = Number((error.response.headers || {})['retry-after']) || 1;
                await sleep(retryAfter * 1000);
                continue;
            }
            // Normalize so callers can branch on err.statusCode like the old client.
            if (status && error.statusCode === undefined) {
                error.statusCode = status;
                error.statusMessage = error.response.statusText;
            }
            throw error;
        }
    }
}

module.exports = {

    normalizeStore,

    /**
     * Run a GraphQL Admin API query or mutation and return its `data`.
     * GraphQL errors become a ShopifyError with an HTTP-like statusCode.
     * @param {Context} context
     * @param {string} query
     * @param {object} [variables]
     * @returns {Promise<object>}
     */
    graphql(context, query, variables) {

        return graphqlClient.gql(context, query, variables, shopifyRequest)
            .catch(err => {
                throw permanentAsCancel(context, err);
            });
    },

    /**
     * `(query, variables) => data` bound to the context — the shape the
     * gql-*.js resource modules take.
     * @param {Context} context
     * @returns {function}
     */
    runner(context) {

        return (query, variables) => this.graphql(context, query, variables);
    },

    /**
     * Normalize multiselect input (array or string) to array format.
     * @param {string|string[]} input
     * @param {object} context
     * @param {string} fieldName
     * @returns {string[]}
     */
    normalizeMultiselectInput(input, context, fieldName) {

        if (Array.isArray(input)) {
            return input;
        } else if (typeof input === 'string') {
            return input.split(',').map(item => item.trim()).filter(item => item.length > 0);
        } else {
            throw new context.CancelError(`${fieldName} must be a string or an array`);
        }
    },

    /**
     * Emit an array of records on an output port honoring the selected outputType
     * (first / array / object / file). Array output is always under `result`.
     * @param {object} params
     * @param {Context} params.context
     * @param {string} [params.outputPortName='out']
     * @param {string} [params.outputType='array']
     * @param {Array<object>} [params.records=[]]
     */
    async sendArrayOutput({
        context,
        outputPortName = 'out',
        outputType = 'array',
        records = []
    }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            const csvString = toCsv(records);
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_EXPORT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    /**
     * Build the dynamic output-port options for an outputType component from a
     * single-item schema. Call from receive() when
     * context.properties.generateOutputPortOptions is set.
     * @param {Context} context
     * @param {string} outputType
     * @param {object} itemSchema map of field -> JSON schema (with title)
     * @param {object} arrayOption { label, value } for the array wrapper
     */
    getOutputPortOptions(context, outputType, itemSchema, { label, value = 'result' }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: fieldLabel, ...schemaWithoutTitle } = schema;

                    res.push({ label: fieldLabel, value: field, schema: schemaWithoutTitle });
                    return res;
                }, [{
                    label: 'Current Item Index',
                    value: 'index',
                    schema: { type: 'integer' }
                }, {
                    label: 'Items Count',
                    value: 'count',
                    schema: { type: 'integer' }
                }]);

            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label,
                value,
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: itemSchema }
                }
            }, {
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    },

    /**
     * Build a ShopifyQL query string for a curated report component.
     * @param {string} dataset e.g. 'sales', 'payments'
     * @param {string[]} metrics columns to SHOW
     * @param {object} opts { since, until, groupBy }
     * @returns {string}
     */
    buildReportQuery(dataset, metrics, { since = '-30d', until = 'today', groupBy } = {}) {

        let query = `FROM ${dataset} SHOW ${metrics.join(', ')} SINCE ${since} UNTIL ${until}`;
        if (groupBy && groupBy !== 'none') {
            query += ` GROUP BY ${groupBy} ORDER BY ${groupBy}`;
        }
        return query;
    },

    /**
     * Run a ShopifyQL query and normalize the result to { columns, rows, rowCount }.
     * Throws a CancelError on ShopifyQL parse errors.
     * @param {Context} context
     * @param {string} query
     */
    async runReport(context, query) {

        const data = await this.graphql(context, RUN_SHOPIFYQL, { q: query });
        const response = data.shopifyqlQuery;

        const parseErrors = (response && response.parseErrors) || [];
        if (parseErrors.length) {
            throw new context.CancelError('Invalid ShopifyQL query: ' + parseErrors.join('; '));
        }

        const tableData = (response && response.tableData) || { columns: [], rows: [] };
        const columns = tableData.columns || [];
        const rows = tableData.rows || [];

        return { columns, rows, rowCount: rows.length };
    },

    /**
     * Subscribe this trigger's webhook URL to the given topics (REST names,
     * e.g. 'orders/create'), reusing subscriptions that already exist for it.
     * The payload is cut down to the ids — triggers read the object itself
     * through GraphQL.
     * @param {Context} context
     * @param {string[]} topics
     * @param {object} [options]
     * @param {string[]} [options.extraFields] payload fields a trigger needs besides the ids
     */
    async registerWebhooks(context, topics, { extraFields = [] } = {}) {

        const includeFields = WEBHOOK_INCLUDE_FIELDS.concat(extraFields);

        const uri = context.getWebhookUrl();
        const data = await this.graphql(context, LIST_WEBHOOKS, { uri });
        const existing = new Map(data.webhookSubscriptions.nodes.map(node => [node.topic, node.id]));

        const webhookIds = [];
        for (const topic of topics) {
            const enumTopic = toTopicEnum(topic);
            if (existing.has(enumTopic)) {
                webhookIds.push(existing.get(enumTopic));
                continue;
            }
            const created = await this.graphql(context, CREATE_WEBHOOK, {
                topic: enumTopic,
                webhookSubscription: { uri, format: 'JSON', includeFields }
            });
            const payload = graphqlClient.checkUserErrors(created.webhookSubscriptionCreate, 'webhookSubscriptionCreate');
            webhookIds.push(payload.webhookSubscription.id);
        }

        return context.saveState({ webhookIds });
    },

    /**
     * Remove the subscriptions registered by registerWebhooks. Failures are
     * ignored: a subscription that is already gone must not block stopping
     * the flow.
     * @param {Context} context
     */
    async unregisterWebhooks(context) {

        const { webhookIds = [] } = await context.loadState();
        for (const id of webhookIds) {
            try {
                await this.graphql(context, DELETE_WEBHOOK, { id: graphqlClient.toGid('WebhookSubscription', id) });
            } catch (err) {
                await context.log({ step: 'webhook-unregister-failed', id, error: err.message });
            }
        }
    },

    /**
     * Handle a webhook delivery in a trigger: drop repeated deliveries of the
     * same event, read the object through `fetch(gid)` and emit it with the
     * webhook topic. `fetch` returning null (the object is gone already) emits
     * nothing. Without `fetch` the trigger emits `{ id }` (delete topics).
     * @param {Context} context
     * @param {object} options
     * @param {string} options.port output port
     * @param {string} options.type GraphQL type of the object, for the gid of delete payloads
     * @param {function} [options.fetch] async gid => object|null
     * @param {function} [options.accept] (payload, topic) => boolean — skip deliveries
     */
    async receiveWebhook(context, { port, type, fetch, accept }) {

        const { headers = {}, data = {} } = context.messages.webhook.content;
        const topic = headers['x-shopify-topic'];
        const eventId = headers['x-shopify-event-id'] || headers['x-shopify-webhook-id'];

        if (eventId) {
            const cacheKey = `shopify-webhook-${context.componentId}-${eventId}`;
            if (await context.staticCache.get(cacheKey)) {
                return context.response();
            }
            await context.staticCache.set(cacheKey, true, WEBHOOK_DEDUPE_TTL_MS);
        }

        if (accept && !accept(data, topic)) {
            return context.response();
        }

        // Some payloads carry no id at all (a checkout before Shopify lists it);
        // `fetch` then gets null and decides from the payload.
        const id = data.admin_graphql_api_id || graphqlClient.toGid(type, data.id) || null;
        const item = fetch ? await fetch(id, data) : { id };
        if (item) {
            await context.sendJson({ ...item, webhookTopic: topic }, port);
        }

        return context.response();
    }
};

// Shopify answers these the same way however often the message is retried
// (invalid query or input, missing scope, unknown object, rejected mutation).
// In a component they become a CancelError, so the engine does not retry them;
// 429 and 5xx stay retryable. The status stays on the error for callers that
// branch on it (auth.js).
const PERMANENT_STATUSES = new Set([400, 403, 404, 422]);

function permanentAsCancel(context, err) {

    if (!err || !PERMANENT_STATUSES.has(err.statusCode) || typeof context.CancelError !== 'function') {
        return err;
    }
    if (err instanceof context.CancelError) {
        return err;
    }
    const cancel = new context.CancelError(err.message);
    cancel.statusCode = err.statusCode;
    cancel.statusMessage = err.statusMessage;
    cancel.details = err.details;
    return cancel;
}

// REST topic ('orders/create', 'draft_orders/update') → WebhookSubscriptionTopic enum.
function toTopicEnum(topic) {

    return String(topic).toUpperCase().replace(/\//g, '_');
}

const RUN_SHOPIFYQL = `query RunShopifyql($q: String!) {
    shopifyqlQuery(query: $q) {
        parseErrors
        tableData { columns { name displayName dataType } rows }
    }
}`;

const LIST_WEBHOOKS = `query ListWebhooks($uri: String!) {
    webhookSubscriptions(first: 100, uri: $uri) { nodes { id topic } }
}`;

const CREATE_WEBHOOK = `mutation CreateWebhook($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
    webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription { id }
        userErrors { field message }
    }
}`;

const DELETE_WEBHOOK = `mutation DeleteWebhook($id: ID!) {
    webhookSubscriptionDelete(id: $id) { deletedWebhookSubscriptionId userErrors { field message } }
}`;

// The trigger reads the object itself, so the payload only needs the ids.
// `updated_at` must be there too: Shopify drops a delivery whose payload equals
// the previous one, so with ids alone every */update after the first (an order
// fires orders/updated when it is created) would never arrive.
const WEBHOOK_INCLUDE_FIELDS = ['id', 'admin_graphql_api_id', 'updated_at'];

// Shopify retries a delivery it did not see acknowledged in time; the same
// event id then arrives twice.
const WEBHOOK_DEDUPE_TTL_MS = 10 * 60 * 1000;

/**
 * Serialize an array of flat objects to CSV.
 * @param {Array<object>} array
 * @returns {string}
 */
function toCsv(array) {
    if (!array || array.length === 0) {
        return '';
    }

    const headers = Object.keys(array[0]);
    if (headers.length === 0) {
        return '';
    }

    return [
        headers.join(','),
        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property != null ? property : '';
            }).join(',');
        })
    ].join('\n');
}
