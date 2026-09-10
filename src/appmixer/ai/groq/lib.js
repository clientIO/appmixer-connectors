'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const API_BASE_URL = 'https://api.groq.com';
const API_PATH_PREFIX = '/openai/v1';
const DEFAULT_PREFIX = 'groq-objects-export';
const DEFAULT_LIST_CACHE_TTL = 2 * 60 * 1000; // 120 s

module.exports = {

    API_BASE_URL,

    /**
     * Base URL every component builds its endpoints on, e.g.
     * `${lib.getBaseUrl()}/chat/completions`.
     * @returns {string}
     */
    getBaseUrl() {
        return `${API_BASE_URL}${API_PATH_PREFIX}`;
    },

    /**
     * Resolve a user supplied endpoint (relative path or absolute URL) against the
     * Groq API base and refuse anything that would send the account's API key
     * somewhere else.
     *
     * Resolving through the WHATWG URL parser and then comparing the resulting
     * origin also rejects protocol-relative input such as `//example.com/x`, which
     * would otherwise silently resolve to a foreign host.
     *
     * Paths without a leading slash stay relative to the OpenAI-compatible prefix
     * (`audio/transcriptions` -> `https://api.groq.com/openai/v1/audio/transcriptions`),
     * paths with one are taken from the host root (`/openai/v1/models`).
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string} url relative path or absolute Groq URL
     * @returns {string} absolute URL on the Groq API host
     */
    resolveApiUrl(context, url) {

        const candidate = String(url);
        const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(candidate) || candidate.startsWith('//');
        const base = isAbsolute || candidate.startsWith('/')
            ? API_BASE_URL
            : `${API_BASE_URL}${API_PATH_PREFIX}/`;

        let parsed;
        try {
            parsed = new URL(candidate, base);
        } catch (error) {
            throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint Path must not contain credentials.');
        }

        if (parsed.origin !== API_BASE_URL) {
            throw new context.CancelError(
                `API Endpoint Path must target ${API_BASE_URL}, got ${parsed.origin}.`
            );
        }

        return parsed.toString();
    },

    /**
     * Thin wrapper around context.httpRequest that applies the Groq auth header.
     * context.httpRequest throws on non-2xx responses, so callers can rely on the
     * response being present.
     * @param {object} args
     * @param {object} args.context Appmixer component context (needs `auth.apiKey`)
     * @param {string} [args.method] HTTP method (default GET)
     * @param {string} [args.path] API path appended to getBaseUrl() (e.g. '/models')
     * @param {string} [args.url] absolute URL, takes precedence over `path`
     * @param {object} [args.data] JSON request body
     * @param {object} [args.params] Query parameters
     * @param {object} [args.headers] Additional request headers
     * @returns {Promise<object>} the whole HTTP response (status, headers, data)
     */
    async request({ context, method = 'GET', path, url, data = null, params = null, headers = null }) {

        const options = {
            method,
            url: url || `${API_BASE_URL}${API_PATH_PREFIX}${path}`,
            headers: {
                accept: 'application/json',
                ...headers,
                Authorization: `Bearer ${context.auth.apiKey}`
            }
        };

        if (data) {
            options.data = data;
            // Only default the content type when the caller has not set one — a
            // multipart form (or a caller-supplied "Content-Type") must win.
            const hasContentType = Object.keys(options.headers).some(key => /^content-type$/i.test(key));
            if (!hasContentType) {
                options.headers['content-type'] = 'application/json';
            }
        }
        if (params && Object.keys(params).length) {
            options.params = params;
        }

        return context.httpRequest(options);
    },

    /**
     * `request` with a per-account response cache, for inspector (dynamic source)
     * calls only. Opening a component inspector fires one source call per dropdown
     * at once; the lock lets the first caller fill the cache while the rest wait and
     * read it, so the API sees one request per burst instead of the whole burst.
     * The key hashes the URL together with the API key so entries are never shared
     * across accounts. TTL comes from `context.config.listCacheTTL` (default 120 s).
     * @param {object} args same as `request`
     * @returns {Promise<object>} `{ data }` — the (possibly cached) response body
     */
    async requestCached(args) {

        const { context, path, url, params = null } = args;
        const key = crypto.createHash('sha256')
            .update(JSON.stringify({ url: url || path, params, token: context.auth.apiKey }))
            .digest('hex');

        let lock;
        try {
            lock = await context.lock(key);

            const cached = await context.staticCache.get(key);
            if (cached) {
                return { data: cached };
            }

            const { data } = await this.request(args);
            await context.staticCache.set(key, data, context.config.listCacheTTL || DEFAULT_LIST_CACHE_TTL);
            return { data };
        } finally {
            lock?.unlock();
        }
    },

    /**
     * Turn the designer's key-value inspector rows into a plain object.
     * @param {array} rows
     * @returns {object}
     */
    keyValueToObject(rows) {

        if (!Array.isArray(rows)) return {};

        return rows.reduce((res, row) => {
            if (row && typeof row === 'object' && typeof row.key === 'string' && row.key.length) {
                res[row.key] = row.value;
            }
            return res;
        }, {});
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
            // Just the first one.
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
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
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
                    const { title, ...schemaWithoutTitle } = schema;

                    res.push({
                        label: title, value: field, schema: schemaWithoutTitle
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

    if (!array || array.length === 0) {
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
