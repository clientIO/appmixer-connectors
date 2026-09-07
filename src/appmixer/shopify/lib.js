'use strict';

// Shopify Admin REST API accessed directly through context.httpRequest — no
// third-party client. This module provides:
//   - a throttled, 429-aware request layer (Shopify allows ~2 req/s),
//   - cursor (Link header) pagination,
//   - response-envelope unwrapping ({ order } / { orders } -> value),
//   - a getShopifyAPI(context) facade whose method shapes mirror the resources
//     the components use, so component bodies stay declarative.

const pathModule = require('path');

const DEFAULT_API_VERSION = '2024-04';
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

function baseUrl(auth, apiVersion) {

    const store = String(auth.store || '').replace(/\.myshopify\.com$/i, '');
    return `https://${store}.myshopify.com/admin/api/${apiVersion || DEFAULT_API_VERSION}`;
}

// Parse the `page_info` cursor for the next page out of the Link response header.
function parseNextPageParameters(linkHeader) {

    if (!linkHeader) {
        return undefined;
    }

    const match = String(linkHeader).split(',').find(part => /rel="next"/.test(part));
    if (!match) {
        return undefined;
    }

    const urlMatch = match.match(/<([^>]+)>/);
    if (!urlMatch) {
        return undefined;
    }

    const query = urlMatch[1].split('?')[1] || '';
    const params = {};
    for (const pair of query.split('&')) {
        if (!pair) continue;
        const [key, value] = pair.split('=');
        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
    }
    return Object.keys(params).length ? params : undefined;
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

// Build a plain array carrying a non-enumerable `nextPageParameters` (mirrors the
// old client's contract, so `pager` works unchanged).
function toListResult(items, headers) {

    const result = Array.isArray(items) ? items.slice() : [];
    Object.defineProperty(result, 'nextPageParameters', {
        value: parseNextPageParameters(headers.link || headers.Link),
        enumerable: false
    });
    return result;
}

// Resource descriptor: REST path segment + singular/plural envelope keys.
const RESOURCES = {
    order: { path: 'orders', one: 'order', many: 'orders' },
    customer: { path: 'customers', one: 'customer', many: 'customers' },
    product: { path: 'products', one: 'product', many: 'products' },
    checkout: { path: 'checkouts', one: 'checkout', many: 'checkouts' },
    location: { path: 'locations', one: 'location', many: 'locations' },
    inventoryLevel: { path: 'inventory_levels', one: 'inventory_level', many: 'inventory_levels' },
    draftOrder: { path: 'draft_orders', one: 'draft_order', many: 'draft_orders' },
    webhook: { path: 'webhooks', one: 'webhook', many: 'webhooks' }
};

// Standard CRUD closures for a resource.
function crud(context, resource) {

    const { path, one, many } = resource;

    return {
        async list(query = {}) {
            const { data, headers } = await shopifyRequest(context, { path: `${path}.json`, query });
            return toListResult(data[many], headers);
        },
        async get(id, query = {}) {
            const { data } = await shopifyRequest(context, { path: `${path}/${id}.json`, query });
            return data[one];
        },
        async count(query = {}) {
            const { data } = await shopifyRequest(context, { path: `${path}/count.json`, query });
            return data.count;
        },
        async create(payload) {
            const { data } = await shopifyRequest(context, { method: 'POST', path: `${path}.json`, body: { [one]: payload } });
            return data[one];
        },
        async update(id, payload) {
            const { data } = await shopifyRequest(context, { method: 'PUT', path: `${path}/${id}.json`, body: { [one]: payload } });
            return data[one];
        },
        async delete(id) {
            await shopifyRequest(context, { method: 'DELETE', path: `${path}/${id}.json` });
            return {};
        }
    };
}

module.exports = {

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
    getOutputPortOptions(context, outputType, itemSchema, { label, value }) {

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
     * Run a ShopifyQL query (GraphQL shopifyqlQuery) and normalize the result to
     * { columns, rows, rowCount }. Throws a CancelError on ShopifyQL parse errors.
     * Shared by RunReport and the curated report components.
     * @param {Context} context
     * @param {string} query
     */
    async runReport(context, query) {

        const shopify = this.getShopifyAPI(context);
        const response = await shopify.report.run(query);

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
     * Facade over the Shopify Admin REST API. Method shapes mirror the resources
     * the components rely on. Requires the full `context` (for context.httpRequest).
     * @param {Context} context
     */
    getShopifyAPI(context) {

        const customer = crud(context, RESOURCES.customer);

        return {
            order: crud(context, RESOURCES.order),
            product: crud(context, RESOURCES.product),
            location: crud(context, RESOURCES.location),
            inventoryLevel: crud(context, RESOURCES.inventoryLevel),
            checkout: crud(context, RESOURCES.checkout),
            draftOrder: crud(context, RESOURCES.draftOrder),

            customer: {
                ...customer,
                async search(query = {}) {
                    const { data, headers } = await shopifyRequest(context, { path: 'customers/search.json', query });
                    return toListResult(data.customers, headers);
                },
                async orders(id, query = {}) {
                    const { data, headers } = await shopifyRequest(context, { path: `customers/${id}/orders.json`, query });
                    return toListResult(data.orders, headers);
                }
            },

            // Refunds and fulfillments are nested under an order.
            refund: {
                async list(orderId, query = {}) {
                    const { data, headers } = await shopifyRequest(context, { path: `orders/${orderId}/refunds.json`, query });
                    return toListResult(data.refunds, headers);
                }
            },
            fulfillment: {
                async list(orderId, query = {}) {
                    const { data, headers } = await shopifyRequest(context, { path: `orders/${orderId}/fulfillments.json`, query });
                    return toListResult(data.fulfillments, headers);
                }
            },

            webhook: {
                async list(query = {}) {
                    const { data, headers } = await shopifyRequest(context, { path: 'webhooks.json', query });
                    return toListResult(data.webhooks, headers);
                },
                async create(payload) {
                    const { data } = await shopifyRequest(context, { method: 'POST', path: 'webhooks.json', body: { webhook: payload } });
                    return data.webhook;
                },
                async delete(id) {
                    await shopifyRequest(context, { method: 'DELETE', path: `webhooks/${id}.json` });
                    return {};
                }
            },

            shop: {
                async get() {
                    const { data } = await shopifyRequest(context, { path: 'shop.json' });
                    return data.shop;
                }
            },

            // Run a ShopifyQL query through the GraphQL Admin API and return the
            // table result. Unlike the (plan-gated) REST Report resource, the
            // shopifyqlQuery field is available on developer/basic plans.
            report: {
                async run(query) {
                    const gql = `query RunShopifyql($q: String!) {
                        shopifyqlQuery(query: $q) {
                            parseErrors
                            tableData {
                                columns { name displayName dataType }
                                rows
                            }
                        }
                    }`;
                    const result = await shopifyRequest(context, {
                        method: 'POST',
                        path: 'graphql.json',
                        body: { query: gql, variables: { q: query } }
                    });
                    return result.data.data.shopifyqlQuery;
                }
            },

            // Minimal GraphQL passthrough (returns the `data` payload).
            async graphql(query, variables, apiVersion) {
                const body = variables ? { query, variables } : { query };
                const { data } = await shopifyRequest(context, { method: 'POST', path: 'graphql.json', body, apiVersion });
                return data.data;
            }
        };
    },

    /**
     * Follow Shopify cursor pagination until all pages are collected.
     * Kept signature-compatible with the previous client-based pager.
     */
    async pager({ shopify, target, operation, params = {} }) {

        const currentPage = await shopify[target][operation](params);
        if (
            currentPage.length === 0 ||
            currentPage.length < (params.limit || 250) ||
            !currentPage.nextPageParameters
        ) {
            return currentPage;
        }

        const nextPage = await this.pager({
            shopify,
            target,
            operation,
            params: currentPage.nextPageParameters
        });
        return currentPage.concat(nextPage);
    },

    processItems(knownItems, actualItems, newItems, item) {

        if (knownItems && !knownItems.has(item['id'])) {
            newItems.add(item);
        }
        actualItems.add(item['id']);
    },

    async registerWebhook(context, topic) {

        const shopify = this.getShopifyAPI(context);
        const address = context.getWebhookUrl();

        const webhooks = await shopify.webhook.list({ address });

        let response;
        if (Array.isArray(webhooks) && webhooks.length > 0) {
            response = webhooks[0];
        } else {
            response = await shopify.webhook.create({ address, topic });
        }

        return context.saveState({ webhookId: response.id });
    },

    // Registers one webhook per topic through GraphQL webhookSubscriptionCreate —
    // most returns/* topics are not exposed on the REST webhook endpoint at all.
    async registerWebhooks(context, topics) {

        const shopify = this.getShopifyAPI(context);
        const address = context.getWebhookUrl();

        const listQuery = `query {
            webhookSubscriptions(first: 100) {
                edges { node {
                    id topic
                    endpoint { ... on WebhookHttpEndpoint { callbackUrl } }
                } }
            }
        }`;
        const listResult = await shopify.graphql(listQuery);
        const existing = new Map();
        (listResult.webhookSubscriptions.edges || []).forEach(({ node }) => {
            if (node.endpoint && node.endpoint.callbackUrl === address) {
                existing.set(node.topic, node.id);
            }
        });

        const webhookIds = [];
        for (const topic of topics) {
            const gqlTopic = topic.toUpperCase().replace('/', '_');
            if (existing.has(gqlTopic)) {
                webhookIds.push(existing.get(gqlTopic));
                continue;
            }
            const mutation = `mutation {
                webhookSubscriptionCreate(topic: ${gqlTopic}, webhookSubscription: { callbackUrl: "${address}", format: JSON }) {
                    webhookSubscription { id }
                    userErrors { message }
                }
            }`;
            const result = await shopify.graphql(mutation);
            const { webhookSubscription, userErrors } = result.webhookSubscriptionCreate;
            if (!webhookSubscription) {
                throw new Error(`Failed to subscribe to ${topic}: ${(userErrors || []).map(e => e.message).join('; ')}`);
            }
            webhookIds.push(webhookSubscription.id);
        }

        return context.saveState({ webhookIds });
    },

    async onReceive(context, port) {

        const { headers, data } = context.messages.webhook.content;

        data.webhookTopic = headers['x-shopify-topic'];
        await context.sendJson(data, port);

        return context.response();
    },

    async unregisterWebhook(context) {

        const shopify = this.getShopifyAPI(context);
        const { webhookId, webhookIds } = await context.loadState();

        const ids = Array.isArray(webhookIds) ? webhookIds : (webhookId ? [webhookId] : []);
        return Promise.all(ids.map(id => {
            // GraphQL-registered subscriptions carry a gid, REST-registered ones a number.
            const remove = String(id).startsWith('gid://')
                ? shopify.graphql(`mutation {
                    webhookSubscriptionDelete(id: "${id}") { deletedWebhookSubscriptionId userErrors { message } }
                }`)
                : shopify.webhook.delete(id);
            return remove.catch(() => {});
        }));
    },

    async fetchLatestWebhookExample(context, { resource, topic, params = {} }) {

        const shopify = this.getShopifyAPI(context);
        const records = await shopify[resource].list({ limit: 1, ...params });

        const record = Array.isArray(records) ? records[0] : null;
        if (!record) {
            return null;
        }

        record.webhookTopic = topic;
        return record;
    },

    async fetchLatestDeleteExample(context, { resource, topic, params = {} }) {

        const shopify = this.getShopifyAPI(context);
        const listParams = resource === 'order' ? { status: 'any', ...params } : params;
        const records = await shopify[resource].list({ limit: 1, ...listParams });

        const record = Array.isArray(records) ? records[0] : null;
        if (!record) {
            return null;
        }

        return { id: record.id, webhookTopic: topic };
    },

    async fetchLatestOrderChildExample(context, { child, topic }) {

        const shopify = this.getShopifyAPI(context);
        const orders = await shopify.order.list({ status: 'any', limit: 20, order: 'created_at DESC' });

        if (!Array.isArray(orders)) {
            return null;
        }

        for (const order of orders) {
            const children = await shopify[child].list(order.id, { limit: 1 });
            if (Array.isArray(children) && children[0]) {
                const record = children[0];
                record.webhookTopic = topic;
                return record;
            }
        }

        return null;
    },

    async fetchLatestInventoryLevelExample(context, topic) {

        const shopify = this.getShopifyAPI(context);
        const locations = await shopify.location.list({ limit: 1 });
        const location = Array.isArray(locations) ? locations[0] : null;

        if (!location) {
            return null;
        }

        const levels = await shopify.inventoryLevel.list({ location_ids: String(location.id), limit: 1 });
        const level = Array.isArray(levels) ? levels[0] : null;

        if (!level) {
            return null;
        }

        level.webhookTopic = topic;
        return level;
    }
};

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
