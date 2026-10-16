'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const API_BASE_URL = 'https://api.typesafe.ai';
const DEFAULT_MODEL = 'jev-latest';
const DEFAULT_PREFIX = 'typesafe-objects-export';
const DEFAULT_LIST_CACHE_TTL = 2 * 60 * 1000; // 120 s

// Question id used by the single-question components (Classify Text, Score Text,
// Verify Statement). The id is never shown to the user.
const QUESTION_ID = 'decision';

// Request errors the API answers deterministically; a retry would fail the same way.
const NON_RETRYABLE_STATUSES = [400, 403, 404, 422];

module.exports = {

    API_BASE_URL,
    DEFAULT_MODEL,

    /**
     * Resolve a user supplied endpoint (relative path or absolute URL) against the
     * TypeSafe API base and refuse anything that would send the account's API key
     * somewhere else.
     *
     * Resolving through the WHATWG URL parser and then comparing the resulting
     * origin also rejects protocol-relative input such as `//example.com/x`, which
     * would otherwise silently resolve to a foreign host.
     * @param {object} context Appmixer component context (for CancelError)
     * @param {string} url relative path (e.g. '/v1/models') or absolute TypeSafe URL
     * @returns {string} absolute URL on the TypeSafe API host
     */
    resolveApiUrl(context, url) {

        const value = String(url);
        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith('//')
            ? value
            : `${value.startsWith('/') ? '' : '/'}${value}`;

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
     * Thin wrapper around context.httpRequest that applies the TypeSafe auth header.
     * `401` (invalid key) and the request errors `400` (unknown model, too many
     * levels), `403`, `404` and `422` (validation) are turned into a CancelError with
     * the API's message — retrying them cannot succeed. Everything else, notably
     * `429` (rate limit) and `529` (overloaded), is rethrown as is so the engine
     * retries the message with its backoff.
     * @param {object} args
     * @param {object} args.context Appmixer component context (needs `auth.apiKey`)
     * @param {string} [args.method] HTTP method (default GET)
     * @param {string} [args.path] API path appended to the base URL (e.g. '/v1/models')
     * @param {string} [args.url] absolute URL, takes precedence over `path`
     * @param {object} [args.data] JSON request body
     * @param {object} [args.params] Query parameters
     * @param {object} [args.headers] Additional request headers
     * @returns {Promise<object>} the whole HTTP response (status, headers, data)
     */
    async request({ context, method = 'GET', path, url, data = null, params = null, headers = null }) {

        const options = {
            method,
            url: url || `${API_BASE_URL}${path}`,
            headers: {
                accept: 'application/json',
                ...headers,
                Authorization: `Bearer ${context.auth.apiKey}`
            }
        };

        if (data !== null && data !== undefined) {
            options.data = data;
            const hasContentType = Object.keys(options.headers).some(key => /^content-type$/i.test(key));
            if (!hasContentType) {
                options.headers['content-type'] = 'application/json';
            }
        }
        if (params && Object.keys(params).length) {
            options.params = params;
        }

        try {
            return await context.httpRequest(options);
        } catch (error) {
            const status = error.response && error.response.status;
            if (status === 401) {
                throw new context.CancelError(`Invalid TypeSafe API key: ${getErrorMessage(error)}`);
            }
            if (NON_RETRYABLE_STATUSES.includes(status)) {
                throw new context.CancelError(`TypeSafe rejected the request (${status}): ${getErrorMessage(error)}`);
            }
            throw error;
        }
    },

    /**
     * `request` with a per-account response cache, for inspector (dynamic source)
     * calls only. The lock lets the first caller fill the cache while concurrent
     * inspector calls wait and read it. The key hashes the URL together with the
     * API key so entries are never shared across accounts. TTL comes from
     * `context.config.listCacheTTL` (default 120 s).
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
     * Validate the Content input. A string is sent as is, an object or array
     * arriving from a variable is sent as structured JSON.
     * @param {object} context
     * @param {*} state
     * @returns {string|object|array}
     */
    getState(context, state) {

        if (state === undefined || state === null || (typeof state === 'string' && !state.trim())) {
            throw new context.CancelError('Content is required!');
        }
        if (typeof state === 'object') {
            return state;
        }
        return String(state);
    },

    /**
     * Rows of an `expression` inspector input (`{ ADD: [row, ...] }`). A plain
     * array or its JSON string is accepted too, so the input can be mapped from a
     * variable. Rows with every field empty (the designer's blank row) are dropped.
     * @param {object} context
     * @param {*} value
     * @param {string} label input label used in error messages
     * @returns {array<object>}
     */
    getRows(context, value, label) {

        let parsed = value;
        if (typeof parsed === 'string') {
            if (!parsed.trim()) return [];
            try {
                parsed = JSON.parse(parsed);
            } catch (error) {
                throw new context.CancelError(`${label} must be a list of rows or a JSON array.`);
            }
        }

        let rows = [];
        if (Array.isArray(parsed)) {
            rows = parsed;
        } else if (parsed && Array.isArray(parsed.ADD)) {
            rows = parsed.ADD;
        } else if (parsed) {
            throw new context.CancelError(`${label} must be a list of rows or a JSON array.`);
        }

        return rows
            .map(row => (row && typeof row === 'object') ? row : { value: row })
            .filter(row => Object.values(row).some(field => field !== undefined && field !== null && String(field).trim() !== ''));
    },

    /**
     * Send one question to POST /v1/systemone and return its answer.
     * @param {object} args
     * @param {object} args.context
     * @param {string} [args.model] model name or alias (default jev-latest)
     * @param {*} args.state the content the question is about
     * @param {object} args.question Question in the API shape (type, instructions, criteria)
     * @returns {Promise<{answer: object, model: string, usage: object}>}
     */
    async askQuestion({ context, model, state, question }) {

        // https://docs.typesafe.ai/api
        const { data } = await this.request({
            context,
            method: 'POST',
            path: '/v1/systemone',
            data: {
                state,
                model: model || DEFAULT_MODEL,
                questions: { [QUESTION_ID]: question }
            }
        });

        const answer = data && data.answers && data.answers[QUESTION_ID];
        if (!answer) {
            throw new Error('TypeSafe returned no answer for the question.');
        }

        return { answer, model: data.model, usage: data.usage || {} };
    },

    /**
     * The live API returns `probabilities` / `legend` of a score answer as maps
     * keyed by level index; the Primitives page shows arrays. Normalise both to a
     * map keyed by the index as a string so the output shape does not depend on it.
     * @param {object|array} value
     * @returns {object}
     */
    toIndexedMap(value) {

        if (Array.isArray(value)) {
            return value.reduce((res, item, index) => {
                res[String(index)] = item;
                return res;
            }, {});
        }
        return value && typeof value === 'object' ? value : {};
    },

    /**
     * Output fields of a score answer, shared by Score Text and Ask Questions.
     * `level` is the most probable level; `score` itself is the probability-weighted
     * average, so it is usually not a whole number.
     * @param {object} answer score answer from the API
     * @param {array<string>} [criteria] the level descriptions that were sent
     * @returns {{score: number, level: number|null, levelDescription: string|null,
     *     confidence: number, probabilities: object}}
     */
    scoreOutput(answer, criteria = []) {

        const probabilities = this.toIndexedMap(answer.probabilities);
        const legend = this.toIndexedMap(answer.legend);

        let level = null;
        Object.keys(probabilities).forEach(key => {
            if (level === null || probabilities[key] > probabilities[String(level)]) {
                level = Number(key);
            }
        });

        let levelDescription = null;
        if (level !== null) {
            levelDescription = legend[String(level)] !== undefined ? legend[String(level)] : (criteria[level] ?? null);
        }

        return {
            score: answer.score,
            level,
            levelDescription,
            confidence: answer.confidence,
            probabilities
        };
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
 * Best effort extraction of the API's error message. Validation errors (422) come
 * as `{ detail: [{ loc, msg }] }`, the rest as `{ detail: { error_type, message } }`
 * or `{ detail: '...' }`; `{ error: { message } }`, `{ message }` and plain text
 * are covered for whatever sits in front of the API.
 * @param {object} error the error thrown by context.httpRequest
 * @returns {string}
 */
const getErrorMessage = (error) => {

    const data = error.response && error.response.data;
    if (!data) {
        return error.message;
    }
    if (typeof data === 'string') {
        return data;
    }
    if (Array.isArray(data.detail)) {
        return data.detail
            .map(item => {
                if (!item || typeof item !== 'object') return String(item);
                const location = Array.isArray(item.loc) ? item.loc.join('.') : '';
                return location ? `${location}: ${item.msg}` : (item.msg || JSON.stringify(item));
            })
            .join('; ');
    }
    if (typeof data.detail === 'string') {
        return data.detail;
    }
    if (data.detail && typeof data.detail === 'object' && data.detail.message) {
        return data.detail.message;
    }
    if (data.error && typeof data.error === 'object' && data.error.message) {
        return data.error.message;
    }
    if (typeof data.error === 'string') {
        return data.error;
    }
    if (data.message) {
        return data.message;
    }
    return JSON.stringify(data);
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
