'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const DEFAULT_PREFIX = 'csas-objects-export';

// Česká spořitelna Accounts API v3. The base URL is overridable in the service
// configuration (`accountsApiBaseUrl`) so an instance can point at the Erste sandbox
// (https://webapi.developers.erstegroup.com/api/csas/public/sandbox/v3/accounts).
const DEFAULT_ACCOUNTS_API_BASE_URL = 'https://www.csas.cz/webapi/api/v3/accounts';

// Pagination: `page` is indexed from zero, `size` maxes out at 100. The page loop is
// capped so a misbehaving `pageCount` can never spin forever.
const PAGE_SIZE = 100;
const MAX_PAGES = 100;

function getAccountsApiBaseUrl(context) {
    return (context.config.accountsApiBaseUrl || DEFAULT_ACCOUNTS_API_BASE_URL).replace(/\/+$/, '');
}

function getHeaders(context, accessToken) {
    if (!context.config.apiKey) {
        throw new context.CancelError('Česká spořitelna API key (WEB-API-key) is not configured. Set "apiKey" in the connector configuration.');
    }
    return {
        'WEB-API-key': context.config.apiKey,
        'Authorization': 'Bearer ' + (accessToken || context.auth.accessToken)
    };
}

// Česká spořitelna returns errors as { status, errors: [{ error, message? }] }.
function toCancelError(context, error) {
    const response = error && error.response;
    if (!response) {
        return new context.CancelError(error && error.message ? error.message : 'Česká spořitelna request failed');
    }
    const body = response.data || {};
    const codes = Array.isArray(body.errors)
        ? body.errors.map(item => (item && (item.message || item.error)) || '').filter(Boolean).join(', ')
        : '';
    const detail = codes || body.message || error.message || 'unexpected error';

    if (response.status === 401 || response.status === 403) {
        return new context.CancelError(`Česká spořitelna denied access (${response.status}): ${detail}. Reconnect the account and check the API key.`);
    }
    if (response.status === 404) {
        return new context.CancelError(`Česká spořitelna resource not found (404): ${detail}. Check the account ID.`);
    }
    return new context.CancelError(`Česká spořitelna API error (${response.status}): ${detail}.`);
}

async function apiRequest(context, path, params) {
    try {
        const { data } = await context.httpRequest({
            method: 'GET',
            url: getAccountsApiBaseUrl(context) + path,
            params,
            headers: getHeaders(context)
        });
        return data || {};
    } catch (error) {
        throw toCancelError(context, error);
    }
}

// Pages through a list endpoint and returns the flattened `field` array. Stops when the
// last page is reached, or when the API does not echo the requested page back (it would
// otherwise return the same page again and again).
async function fetchAllPages(context, path, field, params = {}) {
    const records = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const data = await apiRequest(context, path, { ...params, page, size: PAGE_SIZE });
        const batch = Array.isArray(data[field]) ? data[field] : [];
        const pageNumber = Number(data.pageNumber);
        if (page > 0 && pageNumber !== page) {
            // A repeated page would duplicate records.
            return records;
        }
        records.push(...batch);

        const pageCount = Number(data.pageCount);
        if (!batch.length || !Number.isFinite(pageCount) || page + 1 >= pageCount) {
            return records;
        }
    }
    await context.log({ step: 'page-cap', message: `Reached the ${MAX_PAGES * PAGE_SIZE} record limit; narrow the date range to retrieve the rest.` });
    return records;
}

// The account's bearer token and the WEB-API-key are attached to every MakeApiCall
// request, so the target is pinned to the origin of the configured API base URL. A
// relative path is resolved against the Accounts API base URL.
function resolveApiUrl(context, url) {
    const baseUrl = getAccountsApiBaseUrl(context);
    const origin = new URL(baseUrl).origin;
    const isAbsolute = /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//');
    const candidate = isAbsolute ? url : baseUrl + (url.startsWith('/') ? '' : '/') + url;

    let parsed;
    try {
        parsed = new URL(candidate);
    } catch (error) {
        throw new context.CancelError(`API Endpoint Path is not a valid URL: ${url}`);
    }
    if (parsed.username || parsed.password) {
        throw new context.CancelError('API Endpoint Path must not contain credentials.');
    }
    if (parsed.origin !== origin) {
        throw new context.CancelError(`API Endpoint Path must target ${origin}, got ${parsed.origin}.`);
    }
    return parsed.toString();
}

function getCacheKey(obj) {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
}

// Caches a dropdown (source) call so opening the inspector does not hammer the API.
async function withCache(context, keyParts, fn) {
    const key = 'csas-' + getCacheKey({ ...keyParts, token: context.auth.accessToken });
    let lock;
    try {
        lock = await context.lock(key);
        const cached = await context.staticCache.get(key);
        if (cached) {
            return cached;
        }
        const value = await fn();
        await context.staticCache.set(key, value, context.config.listCacheTTL || (2 * 60 * 1000));
        return value;
    } finally {
        if (lock) {
            await lock.unlock();
        }
    }
}

module.exports = {

    DEFAULT_ACCOUNTS_API_BASE_URL,
    getAccountsApiBaseUrl,
    getHeaders,
    apiRequest,
    fetchAllPages,
    resolveApiUrl,
    withCache,

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
    }
};

const toCsv = (array) => {
    // An empty result set is ordinary (new account, filter matches nothing), so
    // never index into array[0] before checking — that throws a TypeError that
    // ends the flow instead of writing an empty file.
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
