'use strict';

const crypto = require('crypto');
const pathModule = require('path');

// Hugging Face splits its surface over two hosts:
//  - the Hub API (repository metadata, search, whoami) on huggingface.co
//  - Inference Providers (chat, embeddings, classification, images) on
//    router.huggingface.co, which is OpenAI-compatible under /v1
const HUB_API_BASE_URL = 'https://huggingface.co';
const ROUTER_BASE_URL = 'https://router.huggingface.co';
const DEFAULT_PREFIX = 'huggingface-objects-export';

const ALLOWED_ORIGINS = [HUB_API_BASE_URL, ROUTER_BASE_URL];

// Dropdown source calls fire in a burst every time an inspector opens, so their
// responses are cached per user and query for this long unless the instance
// overrides it via `config.listCacheTTL`.
const DEFAULT_LIST_CACHE_TTL = 2 * 60 * 1000;

module.exports = {

    HUB_API_BASE_URL,
    ROUTER_BASE_URL,

    /**
     * Resolve a user supplied endpoint (relative path or absolute URL) against a
     * Hugging Face base URL and refuse anything that would send the account's
     * access token to a foreign host.
     *
     * Resolving through the WHATWG URL parser and then comparing the resulting
     * origin also rejects protocol-relative input such as `//example.com/x`,
     * which would otherwise silently resolve to another host.
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string} url relative path (e.g. '/api/models') or absolute Hugging Face URL
     * @param {string} baseUrl origin a relative path is resolved against
     * @returns {string} absolute URL on a Hugging Face host
     */
    resolveApiUrl(context, url, baseUrl) {

        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
            ? url
            : `${url.startsWith('/') ? '' : '/'}${url}`;

        let parsed;
        try {
            parsed = new URL(candidate, baseUrl);
        } catch (error) {
            throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint Path must not contain credentials.');
        }

        if (!ALLOWED_ORIGINS.includes(parsed.origin)) {
            throw new context.CancelError(
                `API Endpoint Path must target ${ALLOWED_ORIGINS.join(' or ')}, got ${parsed.origin}.`
            );
        }

        return parsed.toString();
    },

    /**
     * Thin wrapper around context.httpRequest that applies the Hugging Face
     * bearer token and returns the parsed response body. context.httpRequest
     * throws on non-2xx responses, so callers can rely on the body being present.
     * @param {object} args
     * @param {object} args.context Appmixer component context (needs `auth.apiKey`)
     * @param {string} [args.method] HTTP method (default GET)
     * @param {string} [args.baseUrl] origin to call (default the Hub API)
     * @param {string} args.path API path starting with a slash, query string included
     *   (e.g. '/api/models?limit=100'). Callers build the query themselves because
     *   the Hub expects repeated keys where the default axios serializer would emit
     *   the `key[]=` bracket form.
     * @param {object} [args.data] JSON request body
     * @param {string} [args.responseType] axios response type, e.g. 'arraybuffer' for images
     * @returns {Promise<*>} the parsed response body
     */
    async makeRequest({
        context,
        method = 'GET',
        baseUrl = HUB_API_BASE_URL,
        path,
        data = null,
        responseType = null
    }) {

        const options = {
            method,
            url: baseUrl + path,
            headers: {
                Authorization: `Bearer ${context.auth.apiKey}`
            }
        };

        if (data) {
            options.data = data;
            options.headers['Content-Type'] = 'application/json';
        }

        if (responseType) {
            options.responseType = responseType;
        }

        const response = await context.httpRequest(options);
        return response ? response.data : null;
    },

    /**
     * `makeRequest` for dropdown source calls: the designer fires one call per
     * dropdown every time an inspector opens, so the response is cached per user and
     * per query and the burst is collapsed onto a single upstream request by the lock.
     * @param {object} args same shape as makeRequest
     * @returns {Promise<*>} the parsed response body
     */
    async makeRequestCached(args) {

        const { context, method = 'GET', baseUrl = HUB_API_BASE_URL, path } = args;
        const key = crypto.createHash('sha256')
            .update(JSON.stringify({ method, url: baseUrl + path, token: context.auth.apiKey }))
            .digest('hex');

        let lock;
        try {
            lock = await context.lock(key);

            const cached = await context.staticCache.get(key);
            if (cached) {
                return cached;
            }

            const data = await module.exports.makeRequest(args);
            const ttl = (context.config && context.config.listCacheTTL) || DEFAULT_LIST_CACHE_TTL;
            await context.staticCache.set(key, data, ttl);

            return data;
        } finally {
            if (lock) {
                lock.unlock();
            }
        }
    },

    /**
     * Encode a Hub repository ID for use inside a URL path. Repository IDs contain
     * a slash (`author/name`) which must survive as a path separator, so each
     * segment is encoded on its own.
     * @param {string} repoId e.g. 'meta-llama/Llama-3.1-8B-Instruct'
     * @returns {string}
     */
    encodeRepoId(repoId) {

        return String(repoId)
            .trim()
            .split('/')
            .map(segment => encodeURIComponent(segment))
            .join('/');
    },

    /**
     * Normalize the Hub `gated` field, which is `'auto'`, `'manual'` or `false`,
     * into a plain string so the declared output schema stays a single type.
     * @param {string|boolean|undefined} gated
     * @returns {string}
     */
    normalizeGated(gated) {

        return gated ? String(gated) : 'none';
    },

    /**
     * Split a comma or newline separated user input into a trimmed array.
     * Returns undefined for empty input so the key can be omitted from the
     * request entirely rather than sent as an empty array.
     * @param {string} value raw inspector input
     * @returns {array|undefined}
     */
    toList(value) {

        if (!value) {
            return undefined;
        }

        const items = String(value)
            .split(/[\n,]/)
            .map(item => item.trim())
            .filter(item => item.length > 0);

        return items.length ? items : undefined;
    },

    /**
     * Parse a JSON string coming from a textarea inspector input. Returns
     * undefined for empty input and raises a CancelError for malformed JSON so
     * the user sees what to fix instead of an opaque runtime error.
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string|object} value raw inspector input
     * @param {string} label human readable field name used in the error message
     * @returns {*|undefined}
     */
    parseJson(context, value, label) {

        if (value === undefined || value === null || value === '') {
            return undefined;
        }

        if (typeof value === 'object') {
            return value;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            throw new context.CancelError(`${label} must be valid JSON.`);
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
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: fieldLabel, ...schemaWithoutTitle } = schema;

                    res.push({
                        label: fieldLabel, value: field, schema: schemaWithoutTitle
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
                    items: {
                        type: 'object',
                        properties: itemSchema
                    }
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

    if (!array.length) {
        return '';
    }

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
