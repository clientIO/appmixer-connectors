'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const DEFAULT_PREFIX = 'github-objects-export';

module.exports = {

    async apiRequest(context, action, {
        method = 'GET',
        body = {},
        params = {}
    } = {}) {

        const url = `https://api.github.com/${action}`;
        const options = {
            method,
            url,
            headers: {
                'accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Authorization': `Bearer ${context.accessToken || context.auth?.accessToken}`
            },
            data: body,
            params: {
                ...params,
                per_page: 100
            }
        };

        return await context.httpRequest(options);
    },

    async apiRequestPaginated(context, action, {
        method = 'GET',
        body = {},
        params = {}
    } = {}) {

        let items = [];
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            const { data, headers } = await this.apiRequest(context, action, {
                method,
                body,
                params: {
                    ...params,
                    per_page: 100,
                    page
                }
            });

            items = items.concat(data);

            const linkHeader = headers.link;
            if (linkHeader) {
                const links = linkHeader.split(',').map(link => link.trim());
                const nextLink = links.find(link => link.includes('rel="next"'));
                hasNextPage = !!nextLink;
            } else {
                hasNextPage = false;
            }

            page++;
        }

        return items;
    },

    /**
     * Fetch the single newest record from a GitHub list/search endpoint, reusing the same
     * request path (`apiRequest`) that triggers' `tick()` use. Shared by every trigger's
     * `test()` (Flow Test Mode) so the emitted item is identical in shape to production.
     *
     * Honors the caller's params (e.g. newest-first sort) and forces `per_page: 1`. Handles
     * both plain list responses (`data` is an array) and the search API shape
     * (`data.items` is an array). Returns the first record, or `null` if none.
     *
     * @param {Object} context
     * @param {String} action GitHub API path (relative to https://api.github.com/)
     * @param {Object} [options]
     * @param {Object} [options.params] extra query params (merged before per_page override)
     * @returns {Promise<Object|null>}
     */
    async fetchLatest(context, action, { params = {} } = {}) {

        const res = await this.apiRequest(context, action, {
            params: { ...params, per_page: 1 }
        });

        const data = res.data;
        const records = Array.isArray(data)
            ? data
            : (data && Array.isArray(data.items) ? data.items : []);

        return records.length ? records[0] : null;
    },

    /**
     * Run a query or mutation against the GitHub GraphQL API (the only way to reach
     * Projects v2). GraphQL answers with HTTP 200 even for errors, so the `errors`
     * array is turned into a CancelError here — every caller gets the same handling.
     *
     * @param {Object} context
     * @param {String} query GraphQL document
     * @param {Object} [variables]
     * @returns {Promise<Object>} the `data` object of the GraphQL response
     */
    async graphqlRequest(context, query, variables = {}) {

        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.github.com/graphql',
            headers: {
                'Authorization': `Bearer ${context.accessToken || context.auth?.accessToken}`,
                'Content-Type': 'application/json',
                'User-Agent': 'Appmixer GitHub Connector'
            },
            data: { query, variables }
        });

        if (data.errors) {
            const message = data.errors.map(error => error.message).filter(Boolean).join('; ');
            throw new context.CancelError(message || JSON.stringify(data.errors));
        }

        return data.data;
    },

    /**
     * Verify the `X-Hub-Signature-256` header GitHub sends with every delivery of a
     * webhook that was registered with a secret.
     *
     * Note: components only see the *parsed* body, so the digest is computed over a
     * re-serialization of it. That matches GitHub's compact JSON for ordinary
     * payloads but is not byte-exact in every case, which is why signature checking
     * is opt-in on the trigger rather than always-on.
     *
     * @param {Object} options
     * @param {Object|String|Buffer} options.payload webhook body
     * @param {String} options.signatureHeader value of the X-Hub-Signature-256 header
     * @param {String} options.secret secret the webhook was registered with
     * @returns {Boolean}
     */
    verifyWebhookSignature({ payload, signatureHeader, secret }) {

        if (!signatureHeader || !secret) return false;

        const body = Buffer.isBuffer(payload)
            ? payload
            : Buffer.from(typeof payload === 'string' ? payload : JSON.stringify(payload), 'utf8');
        const expected = `sha256=${crypto.createHmac('sha256', secret).update(body).digest('hex')}`;

        try {
            return crypto.timingSafeEqual(Buffer.from(signatureHeader), Buffer.from(expected));
        } catch (err) {
            // Different lengths — timingSafeEqual throws instead of returning false.
            return false;
        }
    },

    /**
     * Process items to find newly added.
     * @param knowItems
     * @param {Set} actualItems
     * @param {String} key
     */
    getNewItems(knowItems, actualItems, key) {

        const newItems = new Set();
        const actual = new Set();

        actualItems.forEach(item => {
            if (knowItems && !knowItems.has(item[key])) {
                newItems.add(item);
            }
            actual.add(item[key]);
        });

        return { diff: Array.from(newItems), actual: Array.from(actual) };
    },

    /**
     * Normalize multiselect input (array or string) to array format.
     * Strings are treated as single values or comma-separated lists.
     * @param {string|string[]} input
     * @param {object} context
     * @param {string} fieldName
     * @returns {string[]}
     */
    normalizeMultiselectInput(input, context, fieldName) {

        if (Array.isArray(input)) {
            return input;
        } else if (typeof input === 'string') {
            // Handle single string value or comma-separated string
            return input.split(',').map(item => item.trim()).filter(item => item.length > 0);
        } else {
            throw new context.CancelError(`${fieldName} must be a string or an array`);
        }
    },

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
            // One by one.
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            // All at once.
            return await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getProperty(obj, path) {
        return path.split('.').reduce((acc, part) => acc?.[part], obj);
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: label, ...schemaWithoutTitle } = schema;

                    res.push({
                        label, value: field, schema: schemaWithoutTitle
                    });
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
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }, {
                label: label,
                value: 'result',
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: itemSchema }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }

};

/**
 * @param {array} array
 * @returns {string}
 */
const toCsv = (array) => {
    const headers = Object.keys(array[0]);

    return [
        headers.join(','),

        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })

    ].join('\n');
};
