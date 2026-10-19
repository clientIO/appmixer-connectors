'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const DEFAULT_PREFIX = 'posthog-objects-export';

const getBaseUrl = (context) => {
    return (context.auth.host || 'https://us.posthog.com').replace(/\/+$/, '');
};

const getCacheKey = (obj) => {
    return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex');
};

/**
 * Single entry point for all PostHog private API calls (Personal API key, Bearer auth).
 * `url` can be relative (e.g. '/api/projects/') or absolute.
 */
const apiCall = async (context, { method = 'GET', url, params, data, headers = {} } = {}) => {
    const fullUrl = /^https?:\/\//.test(url) ? url : `${getBaseUrl(context)}${url}`;
    return context.httpRequest({
        method,
        url: fullUrl,
        headers: {
            'Authorization': `Bearer ${context.auth.apiKey}`,
            ...headers
        },
        params,
        data
    });
};

// The CLI test runner provides no staticCache/lock (access throws) — treat the
// cache as best-effort so components still work there.
const cacheGet = async (context, key) => {
    try {
        return await context.staticCache.get(key);
    } catch (err) {
        return undefined;
    }
};

const cacheSet = async (context, key, value, ttl) => {
    try {
        await context.staticCache.set(key, value, ttl);
    } catch (err) {
        // Cache unavailable — nothing to do.
    }
};

const acquireLock = async (context, key) => {
    try {
        return await context.lock(key);
    } catch (err) {
        return null;
    }
};

/**
 * Cached GET for dynamic inspector source calls. The designer fires source calls
 * in concurrent bursts, so the first caller populates the cache under a lock and
 * the rest read the cached value.
 */
const apiCallCached = async (context, url) => {
    let lock;
    try {
        const key = getCacheKey({ url, host: context.auth.host, token: context.auth.apiKey });
        lock = await acquireLock(context, key);
        const cached = await cacheGet(context, key);
        if (cached) return { data: cached };
        const { data } = await apiCall(context, { url });
        await cacheSet(context, key, data, context.config.listCacheTTL || (2 * 60 * 1000));
        return { data };
    } finally {
        await lock?.unlock();
    }
};

/**
 * Returns the public Project API key (api_token) for a project. Cached, as it is
 * needed by every event capture call and never changes unless rotated.
 */
const getProjectApiToken = async (context, projectId) => {
    let lock;
    try {
        const key = getCacheKey({
            resource: 'project-api-token', projectId, host: context.auth.host, token: context.auth.apiKey
        });
        lock = await acquireLock(context, key);
        const cached = await cacheGet(context, key);
        if (cached) return cached;
        const { data } = await apiCall(context, { url: `/api/projects/${projectId}/` });
        await cacheSet(context, key, data['api_token'], 10 * 60 * 1000);
        return data['api_token'];
    } finally {
        await lock?.unlock();
    }
};

/**
 * Diff a list of items against the known set from trigger state.
 */
const getNewItems = (known, items, idField) => {
    const actual = items.map(item => item[idField]);
    if (!known) {
        // First run: establish the baseline, emit nothing.
        return { diff: [], actual };
    }
    const diff = items.filter(item => !known.has(item[idField]));
    return { diff, actual };
};

const sendArrayOutput = async ({ context, outputPortName = 'out', outputType = 'array', records = [] }) => {
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
        // An empty buffer breaks the engine's S3 multipart upload (zero parts →
        // "The XML you provided was not well-formed") — save a newline instead.
        const csvString = toCsv(records) || '\n';
        const buffer = Buffer.from(csvString, 'utf8');
        const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
        const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
        const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
        await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
        await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
};

const getOutputPortOptions = (context, outputType, itemSchema, { label, value }) => {
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
};

const toCsv = (array) => {
    const headers = Object.keys(array[0] || {});
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

module.exports = {
    getBaseUrl,
    apiCall,
    apiCallCached,
    getProjectApiToken,
    getNewItems,
    sendArrayOutput,
    getOutputPortOptions
};
