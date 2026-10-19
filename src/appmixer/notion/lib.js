'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const API_VERSION = '2022-06-28';

const BASE_URL = 'https://api.notion.com/v1';

const API_ORIGIN = new URL(BASE_URL).origin;

const DEFAULT_PREFIX = 'notion-objects-export';

module.exports = {
    API_VERSION,

    // Resolves a user supplied endpoint — a path relative to the API base
    // (`/users/me`) or an absolute URL — and refuses anything that would send the
    // account's token to a host other than the Notion API. Going through the URL
    // parser and comparing the origin also rejects protocol-relative input such as
    // `//example.com/x`.
    resolveApiUrl(context, url) {
        const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');

        let parsed;
        try {
            parsed = new URL(isAbsolute ? url : `${BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`, BASE_URL);
        } catch (error) {
            throw new context.CancelError(`API Endpoint URL is not a valid URL: ${url}`);
        }

        if (parsed.username || parsed.password) {
            throw new context.CancelError('API Endpoint URL must not contain credentials.');
        }

        if (parsed.origin !== API_ORIGIN) {
            throw new context.CancelError(`API Endpoint URL must target ${API_ORIGIN}, got ${parsed.origin}.`);
        }

        return parsed.toString();
    },

    async callEndpoint(context, endpoint, {
        method = 'GET',
        params = {},
        data = null,
        headers = {}
    } = {}) {
        const options = {
            method,
            url: `${BASE_URL}${endpoint}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Notion-Version': API_VERSION, //api version from config.js,
                'Content-Type': 'application/json',
                ...headers
            },
            params
        };

        if (data) {
            options.data = data;
        }

        return await context.httpRequest(options);
    },

    // Shared request+shape path for database-item triggers. Queries a database
    // sorted by `timestamp` in the given `direction` and returns the raw items
    // (the triggers emit the unmodified Notion item object).
    async queryDatabaseItems(context, databaseId, { timestamp, direction = 'descending', pageSize } = {}) {
        const data = {
            sorts: [
                {
                    'timestamp': timestamp,
                    'direction': direction
                }
            ]
        };
        if (pageSize) {
            data.page_size = pageSize;
        }
        const response = await this.callEndpoint(context, `/databases/${databaseId}/query`, {
            method: 'POST',
            data
        });
        return response.data.results || [];
    },

    // The database object with its schema (`properties`). `cached` is for inspector
    // calls (generateInspector), which the designer repeats on every inspector open;
    // a flow run always reads the schema fresh.
    async getDatabase(context, databaseId, { cached = false } = {}) {
        const fetch = async () => (await this.callEndpoint(context, `/databases/${databaseId}`)).data;
        return cached ? this.withCache(context, ['database', databaseId], fetch) : fetch();
    },

    // One poll of a database-item trigger: returns the items whose `timestamp`
    // (`created_time` / `last_edited_time`) moved past the previous poll, oldest first,
    // and the state to save.
    //
    // Notion rounds both timestamps down to the minute, so several items share the
    // newest one. A plain `>` against it would drop every other item touched in that
    // minute; `known` therefore holds the ids already emitted at the boundary minute
    // and those are the only ones skipped there. (A second edit of the SAME item
    // within one minute is indistinguishable from the first and is not emitted.)
    //
    // The first poll only takes a baseline. `initialized` is tracked apart from
    // `lastTimestamp` so that an empty database still counts as a taken baseline.
    async pollDatabaseItems(context, databaseId, timestamp) {
        const items = await this.queryDatabaseItems(context, databaseId, { timestamp, direction: 'descending' });
        const state = context.state || {};
        let { initialized, lastTimestamp = null, known = [] } = state;

        // State written before 2.2.0: `{ since }` by UpdatedDatabaseItem, `{ known }`
        // (ids of the last page) by NewDatabaseItem. Carry on from it without
        // re-emitting what those versions already sent.
        if (!initialized && state.since) {
            initialized = true;
            lastTimestamp = state.since;
            known = items.filter(item => item[timestamp] === lastTimestamp).map(item => item.id);
        } else if (!initialized && Array.isArray(state.known)) {
            initialized = true;
            const seen = items.filter(item => state.known.includes(item.id)).map(item => item[timestamp]);
            lastTimestamp = seen.length ? seen.reduce((max, value) => (value > max ? value : max)) : null;
        }

        const newest = items.reduce(
            (max, item) => (!max || item[timestamp] > max ? item[timestamp] : max),
            lastTimestamp
        );
        const boundaryIds = items.filter(item => item[timestamp] === newest).map(item => item.id);
        const nextState = { initialized: true, lastTimestamp: newest, known: boundaryIds };

        if (!initialized) {
            return { emit: [], state: nextState };
        }

        const knownIds = new Set(known);
        const emit = items
            .filter(item => !lastTimestamp
                || item[timestamp] > lastTimestamp
                || (item[timestamp] === lastTimestamp && !knownIds.has(item.id)))
            .reverse();

        return { emit, state: nextState };
    },

    // Turns an inspector value into the Notion property value object for `property`
    // (an entry of the database schema). Returns undefined when there is nothing to set.
    formatPropertyValue(context, propertyName, property, userInput) {
        switch (property.type) {
            case 'title':
                return { title: [{ text: { content: userInput } }] };
            case 'rich_text':
                return { rich_text: [{ text: { content: userInput } }] };
            case 'multi_select':
                return {
                    multi_select: Array.isArray(userInput)
                        ? userInput.map(option => ({ name: option }))
                        : [{ name: userInput }]
                };
            case 'select':
                return { select: { name: userInput } };
            case 'status':
                return { status: { name: userInput } };
            case 'people':
                return {
                    people: Array.isArray(userInput)
                        ? userInput.map(personId => ({ id: personId }))
                        : [{ id: userInput }]
                };
            case 'date':
                return { date: { start: userInput } };
            case 'checkbox':
                // A variable can deliver the text "false"; Boolean("false") is true.
                return { checkbox: userInput === true || String(userInput).toLowerCase() === 'true' };
            case 'number': {
                if (userInput === '') {
                    return undefined;
                }
                const number = Number(userInput);
                if (Number.isNaN(number)) {
                    throw new context.CancelError(`"${propertyName}" must be a number, got "${userInput}".`);
                }
                return { number };
            }
            case 'email':
                return { email: userInput };
            case 'url':
                return { url: userInput };
            case 'phone_number':
                return { phone_number: userInput };
            case 'files': {
                const urls = (Array.isArray(userInput) ? userInput : String(userInput).split(','))
                    .map(fileUrl => String(fileUrl).trim())
                    .filter(Boolean);
                return {
                    files: urls.map(fileUrl => ({ name: fileUrl.split('/').pop(), external: { url: fileUrl } }))
                };
            }
            default:
                return { [property.type]: userInput };
        }
    },

    // Caches the result of `fn` for dynamic source (inspector dropdown) calls. The
    // designer fires those in a burst whenever an inspector opens: the lock lets the
    // first caller populate the cache while the rest wait and read the cached value.
    // `keyParts` must name everything that shapes the result; the token is always
    // part of the key, so an entry is never shared between accounts.
    async withCache(context, keyParts, fn) {
        const key = crypto.createHash('sha256')
            .update(JSON.stringify({ keyParts, token: context.auth.accessToken }))
            .digest('hex');
        let lock;
        try {
            lock = await context.lock(key);
            const cached = await context.staticCache.get(key);
            if (cached) {
                return cached;
            }
            const result = await fn();
            await context.staticCache.set(key, result, context.config.listCacheTTL || (2 * 60 * 1000));
            return result;
        } finally {
            lock?.unlock();
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

    getOutputPortOptions(context, outputType, itemSchema, { label, value }) {
        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: label, ...schemaWithoutTitle } = schema;
                    res.push({ label, value: field, schema: schemaWithoutTitle });
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
                value: value || 'result',
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

    toCsv(array) {
        return toCsv(array);
    }
};

const toCsv = (array) => {
    // An empty result set is ordinary (new account, nothing shared with the
    // integration), so never index into array[0] before checking — that throws a
    // TypeError that ends the flow instead of writing an empty file.
    if (!array.length) {
        return '';
    }
    const headers = Object.keys(array[0]);
    return [
        headers.map(toCsvValue).join(','),
        ...array.map(item => headers.map(header => toCsvValue(item[header])).join(','))
    ].join('\n');
};

// A value holding a comma, a quote or a line break is quoted and its quotes doubled
// (RFC 4180) — a nested object serialized as JSON always does, and a title may.
const toCsvValue = (value) => {
    if (value === null || value === undefined) {
        return '';
    }
    const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};
