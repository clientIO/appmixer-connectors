'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'cliniko-objects-export';

// Cliniko requires an identifying User-Agent - requests without one may be blocked.
// See https://docs.api.cliniko.com/guides/urls
const USER_AGENT = 'Appmixer (support@appmixer.com)';

// Keys generated before sharding was introduced carry no suffix and live on au1.
const DEFAULT_SHARD = 'au1';
const SHARD_PATTERN = /^[a-z]{2}\d{1,2}$/;

// Cliniko caps `per_page` at 100 on every collection endpoint.
const MAX_PER_PAGE = 100;

module.exports = {

    MAX_PER_PAGE,

    /**
     * Derive the shard from the API key. The shard is appended to the key itself
     * (`...wvNHdeW0pd-au2` => `au2`), so the base URL needs no extra user input.
     * @param {string} apiKey
     * @returns {string}
     */
    getShard(apiKey = '') {

        const parts = String(apiKey).trim().split('-');
        const last = parts[parts.length - 1];

        return SHARD_PATTERN.test(last) ? last : DEFAULT_SHARD;
    },

    /**
     * Base URL for the account behind the credential.
     * @param {object} auth - context.auth, or the context itself inside auth.js
     * @returns {string}
     */
    getBaseUrl(auth = {}) {

        return `https://api.${this.getShard(auth.apiKey)}.cliniko.com/v1`;
    },

    /**
     * Cliniko uses HTTP Basic with the API key as the username and an empty password.
     * @param {object} auth - context.auth, or the context itself inside auth.js
     * @returns {object}
     */
    getAuthHeaders(auth = {}) {

        const encoded = Buffer.from(`${auth.apiKey}:`).toString('base64');

        return {
            'Authorization': `Basic ${encoded}`,
            'Accept': 'application/json',
            'User-Agent': USER_AGENT
        };
    },

    /**
     * Build a Cliniko query string. Filters go into repeated `q[]` parameters
     * (`q[]=last_name:~son&q[]=created_at:>2026-01-01T00:00:00Z`); everything else
     * is a plain query parameter. Empty values are dropped.
     * @param {object} options - { filters: string[], params: object }
     * @returns {string} query string without the leading "?"
     */
    buildQuery({ filters = [], params = {} } = {}) {

        const search = new URLSearchParams();

        for (const filter of filters) {
            if (filter) {
                search.append('q[]', filter);
            }
        }

        for (const [key, value] of Object.entries(params)) {
            if (value !== undefined && value !== null && value !== '') {
                search.append(key, value);
            }
        }

        return search.toString();
    },

    /**
     * Authorized Cliniko API request with base-URL resolution and error normalization.
     * @param {object} context
     * @param {object} options - { method, path, url, filters, params, data, headers }
     * @returns {Promise<object>}
     */
    async apiRequest(context, { method = 'GET', path, url, filters, params, data, headers = {} } = {}) {

        const auth = context.auth || context;
        let target = url || `${this.getBaseUrl(auth)}${path}`;

        // The query string is assembled by hand: axios would serialize the repeated
        // `q[]` filter parameter as `q[][]=...`, which Cliniko does not understand.
        if (!url) {
            const query = this.buildQuery({ filters, params });
            if (query) {
                target += `?${query}`;
            }
        }

        try {
            return await context.httpRequest({
                method,
                url: target,
                headers: { ...this.getAuthHeaders(auth), ...headers },
                data
            });
        } catch (error) {
            throw this.normalizeError(context, error);
        }
    },

    /**
     * Fetch one page of a collection endpoint at the maximum page size.
     * Find/List components deliberately return a single page - Appmixer has no
     * limit/offset inputs and the account-wide rate limit is 200 requests/minute.
     * @param {object} context
     * @param {object} options - { path, collection, filters, params }
     * @returns {Promise<Array>}
     */
    async fetchPage(context, { path, collection, filters = [], params = {} } = {}) {

        const { data } = await this.apiRequest(context, {
            method: 'GET',
            path,
            filters,
            params: { per_page: MAX_PER_PAGE, ...params }
        });

        return (data && data[collection]) || [];
    },

    /**
     * Translate a Cliniko HTTP error into a helpful CancelError.
     * @param {object} context
     * @param {Error} error
     * @returns {Error}
     */
    normalizeError(context, error) {

        const response = error.response || {};
        const status = response.status;
        let body = response.data;

        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) { /* keep the raw string */ }
        }

        const parts = [];

        if (body && typeof body === 'object') {
            // Cliniko's generic envelope title ("Validation Failed") only repeats the hint
            // below - the useful detail is in `errors`.
            if (body.message && body.message.toLowerCase() !== 'validation failed') {
                parts.push(body.message);
            }
            // 422 bodies carry a per-field map: { errors: { last_name: "can't be blank" } }
            if (body.errors && typeof body.errors === 'object') {
                const fields = Object.entries(body.errors)
                    .map(([field, message]) => `${field}: ${Array.isArray(message) ? message.join(', ') : message}`)
                    .join('; ');
                if (fields) {
                    parts.push(fields);
                }
            }
        } else if (typeof body === 'string' && body) {
            parts.push(body);
        }

        const hints = {
            401: 'Authentication failed (401). Check the API key - it is sent as the HTTP Basic username with an empty password.',
            403: 'Access denied (403). The API key inherits the permissions of the user it belongs to; that user is not allowed to access this resource.',
            404: 'Not found (404). The record does not exist, or the resource is not enabled for this account.',
            422: 'Validation failed (422).',
            429: 'Rate limit exceeded (429). Cliniko allows 200 requests per minute per user.'
        };

        const message = [hints[status] || `Cliniko API request failed${status ? ` (${status})` : ''}.`]
            .concat(parts.filter((part) => part && part !== hints[status]))
            .join(' ');

        const cancelError = new context.CancelError(message);
        cancelError.status = status;

        if (status === 429) {
            // UNIX epoch seconds, UTC - surfaced so a retry can wait it out.
            cancelError.rateLimitReset = response.headers && response.headers['x-ratelimit-reset'];
        }

        return cancelError;
    },

    /**
     * Pull the record id out of a Cliniko `links.self` URL.
     * @param {object} relation - e.g. { links: { self: ".../v1/patients/123" } }
     * @returns {string|null}
     */
    idFromLinks(relation) {

        const self = relation && relation.links && relation.links.self;

        if (typeof self !== 'string') {
            return null;
        }

        const match = self.match(/\/([^/?#]+)(?:[?#].*)?$/);

        return match ? match[1] : null;
    },

    /**
     * Cliniko returns related records as link stubs (`patient: { links: { self } }`),
     * so a raw record carries no usable foreign keys. Flatten the ones a flow needs
     * into `<relation>_id` fields so records can be chained into other components.
     * @param {object} record
     * @param {Array<string>} relations
     * @returns {object}
     */
    expandIds(record, relations = []) {

        if (!record || typeof record !== 'object') {
            return record;
        }

        const expanded = { ...record };

        for (const relation of relations) {
            expanded[`${relation}_id`] = this.idFromLinks(record[relation]);
        }

        return expanded;
    },

    /**
     * Shared polling body for the timestamp-driven triggers. Cliniko has no webhooks,
     * so every trigger filters a collection on a timestamp field and deduplicates.
     *
     * State: `{ initialized, lastTimestamp, known }`.
     *   - `initialized` marks that a baseline tick has run. It is tracked separately from
     *     `lastTimestamp` because an empty account yields no timestamp to anchor on - without
     *     the flag the very first record ever created would be swallowed as "the baseline".
     *   - `lastTimestamp` is the newest timestamp seen, re-queried with `>=` so records
     *     written in the same second as the boundary are not skipped.
     *   - `known` holds only the ids sharing that boundary timestamp, which keeps the set
     *     small. A record is a duplicate only when its timestamp still equals the boundary
     *     AND its id is known - a record whose timestamp moved forward is a genuine new
     *     event, which is what makes the Updated* triggers fire on every subsequent edit.
     *
     * @param {object} context
     * @param {object} options - { path, collection, timestampField, filters, relations }
     * @returns {Promise<{ emit: Array, state: object }>}
     */
    async pollByTimestamp(context, { path, collection, timestampField, filters = [], relations = [] } = {}) {

        const { initialized, lastTimestamp, known = [] } = context.state || {};

        const timestampFilters = lastTimestamp
            ? [`${timestampField}:>=${lastTimestamp}`]
            // `:?` means "is not null" - it also lifts Cliniko's default exclusion of
            // cancelled/archived records, which is what makes cancelled_at pollable.
            : [`${timestampField}:?`];

        const records = (await this.fetchPage(context, {
            path,
            collection,
            filters: [...timestampFilters, ...filters],
            params: { sort: `${timestampField}:desc` }
        })).map((record) => this.expandIds(record, relations));

        const stamped = records.filter((record) => record[timestampField]);

        if (!stamped.length) {
            return { emit: [], state: { initialized: true, lastTimestamp: lastTimestamp || null, known } };
        }

        const newest = stamped.reduce(
            (max, record) => (record[timestampField] > max ? record[timestampField] : max),
            stamped[0][timestampField]
        );
        const boundaryIds = stamped
            .filter((record) => record[timestampField] === newest)
            .map((record) => record.id);

        // First tick: take a baseline instead of replaying everything that already exists.
        if (!initialized) {
            return { emit: [], state: { initialized: true, lastTimestamp: newest, known: boundaryIds } };
        }

        const knownSet = new Set(known);
        const emit = stamped
            .filter((record) => !lastTimestamp
                || record[timestampField] > lastTimestamp
                || !knownSet.has(record.id))
            .sort((a, b) => (a[timestampField] < b[timestampField] ? -1 : 1));

        return { emit, state: { initialized: true, lastTimestamp: newest, known: boundaryIds } };
    },

    /**
     * Fetch the single most recent record of a collection - used by trigger `test()`
     * to produce one realistic sample in Flow Test Mode.
     * @param {object} context
     * @param {object} options - { path, collection, timestampField, filters, relations }
     * @returns {Promise<object|null>}
     */
    async fetchLatest(context, { path, collection, timestampField, filters = [], relations = [] } = {}) {

        const { data } = await this.apiRequest(context, {
            method: 'GET',
            path,
            filters: [`${timestampField}:?`, ...filters],
            params: { sort: `${timestampField}:desc`, per_page: 1 }
        });

        const records = (data && data[collection]) || [];

        return records.length ? this.expandIds(records[0], relations) : null;
    },

    /**
     * Drop null/undefined/empty-string values from an object (request bodies, params).
     * @param {object} source
     * @returns {object}
     */
    clean(source = {}) {

        return Object.entries(source).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                acc[key] = value;
            }
            return acc;
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
            await context.log('info', 'File was saved', { fileName, fileId: savedFile.fileId });
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
                    res.push({ label: title, value: field, schema: schemaWithoutTitle });
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
                label,
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
