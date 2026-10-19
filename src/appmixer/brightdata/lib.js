'use strict';

const pathModule = require('path');

const API_BASE_URL = 'https://api.brightdata.com';
const DEFAULT_PREFIX = 'brightdata-objects-export';

// Search engines reachable through the Bright Data SERP API. `param` is the
// engine's query parameter and `extra` maps the generic inputs (country,
// language, result count, page offset) onto that engine's own parameter names.
const SEARCH_ENGINES = {
    google: {
        url: 'https://www.google.com/search',
        param: 'q',
        country: 'gl',
        language: 'hl',
        count: 'num',
        offset: 'start'
    },
    bing: {
        url: 'https://www.bing.com/search',
        param: 'q',
        country: 'cc',
        language: 'setLang',
        count: 'count',
        offset: 'first'
    },
    duckduckgo: {
        url: 'https://duckduckgo.com/',
        param: 'q',
        language: 'kl'
    },
    yandex: {
        url: 'https://yandex.com/search/',
        param: 'text'
    }
};

module.exports = {

    API_BASE_URL,

    SEARCH_ENGINES,

    /**
     * Resolve a user supplied endpoint (relative path or absolute URL) against the
     * Bright Data API base and refuse anything that would send the account's API
     * token somewhere else.
     *
     * Resolving through the WHATWG URL parser and then comparing the resulting
     * origin also rejects protocol-relative input such as `//example.com/x`, which
     * would otherwise silently resolve to a foreign host.
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string} url relative path (e.g. '/datasets/v3/trigger') or absolute Bright Data URL
     * @returns {string} absolute URL on the Bright Data API host
     */
    resolveApiUrl(context, url) {

        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//')
            ? url
            : `${url.startsWith('/') ? '' : '/'}${url}`;

        let parsed;
        try {
            parsed = new URL(candidate, API_BASE_URL);
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
     * The one place that turns a connected account into request headers.
     * @param {object} context Appmixer component context (needs `auth.apiKey`)
     * @returns {object} headers carrying the Bright Data bearer token
     */
    authHeaders(context) {

        return { 'Authorization': `Bearer ${context.auth.apiKey}` };
    },

    /**
     * Send a request through a Bright Data proxy zone (Web Unlocker or SERP API).
     * Both products share the same `POST /request` entry point; `format: raw`
     * hands back the target's own response instead of a Bright Data envelope.
     * @param {object} args
     * @param {object} args.context Appmixer component context
     * @param {string} args.zone the zone name to route the request through
     * @param {string} args.url the target URL to fetch
     * @param {object} [args.extra] additional Bright Data request options (country, data_format, …)
     * @returns {Promise<object>} `{ status, data }` of the proxied response
     */
    async zoneRequest({ context, zone, url, extra = {} }) {

        const response = await context.httpRequest({
            method: 'POST',
            url: `${API_BASE_URL}/request`,
            headers: {
                ...module.exports.authHeaders(context),
                'Content-Type': 'application/json'
            },
            data: { zone, url, format: 'raw', ...extra }
        });

        return { status: response.status, data: response.data };
    },

    /**
     * Thin wrapper around context.httpRequest that applies the Bright Data bearer
     * token and returns the parsed response body. context.httpRequest throws on
     * non-2xx responses, so callers can rely on the body being present.
     * @param {object} args
     * @param {object} args.context Appmixer component context (needs `auth.apiKey`)
     * @param {string} [args.method] HTTP method (default GET)
     * @param {string} args.path API path starting with a slash (e.g. '/request')
     * @param {object} [args.params] query string parameters
     * @param {object} [args.data] JSON request body
     * @returns {Promise<*>} the parsed response body
     */
    async makeRequest({ context, method = 'GET', path, params = null, data = null }) {

        const options = {
            method,
            url: API_BASE_URL + path,
            headers: module.exports.authHeaders(context)
        };

        if (params && Object.keys(params).length) {
            options.params = params;
        }

        if (data) {
            options.data = data;
            options.headers['Content-Type'] = 'application/json';
        }

        const response = await context.httpRequest(options);
        return response ? response.data : null;
    },

    /**
     * Bright Data answers `format: raw` requests with a plain body, so a JSON
     * payload arrives as a string. Parse it when possible and hand back the raw
     * value otherwise.
     * @param {*} value response body
     * @returns {*} parsed object/array, or the original value
     */
    parseMaybeJson(value) {

        if (typeof value !== 'string') {
            return value;
        }

        try {
            return JSON.parse(value);
        } catch (error) {
            return value;
        }
    },

    /**
     * Parse a JSON snippet typed into a textarea input.
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string|object|array} value raw inspector input
     * @param {string} label human readable field name used in the error message
     * @returns {*} the parsed value
     */
    parseJsonInput(context, value, label) {

        if (value === null || value === undefined || value === '') {
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

    /**
     * Build the target search-engine URL that the SERP API zone will fetch.
     * `brd_json=1` asks Bright Data to return the parsed SERP instead of HTML.
     * @param {object} args
     * @param {object} args.context Appmixer component context (for CancelError)
     * @param {string} args.engine one of the SEARCH_ENGINES keys
     * @param {string} args.query the search phrase
     * @param {string} [args.country] two letter country code
     * @param {string} [args.language] two letter language code
     * @param {number} [args.numResults] how many results the engine should return
     * @param {number} [args.page] 1-based result page
     * @returns {string} absolute search URL
     */
    buildSearchUrl({ context, engine, query, country, language, numResults, page }) {

        const definition = SEARCH_ENGINES[engine];
        if (!definition) {
            throw new context.CancelError(`Unsupported search engine: ${engine}`);
        }

        const url = new URL(definition.url);
        url.searchParams.set(definition.param, query);

        if (country && definition.country) {
            url.searchParams.set(definition.country, country);
        }
        if (language && definition.language) {
            url.searchParams.set(definition.language, language);
        }
        if (numResults && definition.count) {
            url.searchParams.set(definition.count, String(numResults));
        }

        const pageNumber = page && page > 1 ? page : 1;
        if (pageNumber > 1 && definition.offset) {
            const perPage = numResults || 10;
            // Google counts results from 0, Bing counts them from 1.
            const base = definition.offset === 'first' ? 1 : 0;
            url.searchParams.set(definition.offset, String(base + (pageNumber - 1) * perPage));
        }

        url.searchParams.set('brd_json', '1');

        return url.toString();
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
