'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'tldv-objects-export';

// tl;dv REST API. Base URL is https://pasta.tldv.io and every path is prefixed with the
// (alpha) API version. Docs: https://doc.tldv.io/index.html
const API_BASE_URL = 'https://pasta.tldv.io';
const API_VERSION = 'v1alpha1';

// Pagination: page is 1-based, limit maxes out at 100. tl;dv rejects queries that would
// return more than 10,000 results, so list/poll loops cap here and warn.
const MAX_PAGE_SIZE = 100;
const MAX_RESULTS = 10000;

module.exports = {

    API_BASE_URL,
    API_VERSION,
    MAX_PAGE_SIZE,
    MAX_RESULTS,

    // Authentication header used by every request. tl;dv keys are passed as `x-api-key`.
    getHeaders(context) {
        return {
            'x-api-key': context.auth.apiKey,
            'Content-Type': 'application/json'
        };
    },

    // Maps a tl;dv error response to a helpful CancelError. tl;dv returns two shapes:
    // validation errors (400) carry an `errors[]` array, everything else carries
    // `{ name, message }`. 403 almost always means the meeting organizer is on the Free
    // plan (not that the key is wrong), so it gets a dedicated, explicit message.
    toCancelError(context, error) {
        const response = error && error.response;
        if (!response) {
            return new context.CancelError(error && error.message ? error.message : 'tl;dv request failed');
        }

        const status = response.status;
        const body = response.data || {};

        if (status === 401) {
            return new context.CancelError('tl;dv authentication failed (401). Check that your API key is valid and has not been revoked.');
        }

        if (status === 403) {
            return new context.CancelError('tl;dv denied access to this meeting (403). API export depends on the plan of the meeting ORGANIZER, not on your key: if the organizer is on the Free plan the meeting is visible in the web app but cannot be read via the API. A paid (Pro/Business/Enterprise) organizer is required.');
        }

        if (status === 404) {
            return new context.CancelError(`tl;dv resource not found (404): ${body.message || 'the meeting or resource does not exist'}.`);
        }

        if (status === 400 && Array.isArray(body.errors)) {
            // The shape of errors[] is not guaranteed (it may contain strings, nulls or
            // objects without `property`/`constraints`), so every item is normalized
            // defensively — a formatting slip here must never mask the original API error.
            const details = body.errors.map((item) => {
                if (!item || typeof item !== 'object') {
                    return typeof item === 'string' ? item : '';
                }
                const constraints = item.constraints && typeof item.constraints === 'object'
                    ? Object.values(item.constraints).join('; ')
                    : '';
                const property = item.property || '';
                if (property && constraints) {
                    return `${property}: ${constraints}`;
                }
                return property || constraints || item.message || '';
            }).filter(Boolean).join(' | ');
            return new context.CancelError(`tl;dv rejected the request (400): ${details || body.message || 'invalid parameters'}.`);
        }

        return new context.CancelError(`tl;dv API error (${status}): ${body.message || error.message || 'unexpected error'}.`);
    },

    // Thin wrapper around context.httpRequest that prefixes the base URL and maps errors to
    // CancelError. Pass `path` (relative to the API base) or a full `url`.
    async apiRequest(context, { method = 'GET', path, url, params, data, headers } = {}) {
        const finalUrl = url || `${API_BASE_URL}${path}`;
        try {
            return await context.httpRequest({
                method,
                url: finalUrl,
                params,
                data,
                headers: { ...module.exports.getHeaders(context), ...(headers || {}) }
            });
        } catch (error) {
            throw module.exports.toCancelError(context, error);
        }
    },

    // Fetches a single page of GET /meetings and returns the raw envelope
    // { page, pages, total, pageSize, results }.
    async fetchMeetingsPage(context, params = {}) {
        const { data } = await module.exports.apiRequest(context, {
            method: 'GET',
            path: `/${API_VERSION}/meetings`,
            params
        });
        return data || {};
    },

    // Pages through GET /meetings until the last page (or the 10,000 result ceiling) and
    // returns the flattened list of meetings. `baseParams` may contain query/from/to/etc.
    async fetchAllMeetings(context, baseParams = {}) {
        const results = [];
        let page = 1;
        let pages = 1;

        do {
            const data = await module.exports.fetchMeetingsPage(context, {
                ...baseParams,
                page,
                limit: MAX_PAGE_SIZE
            });

            const batch = Array.isArray(data.results) ? data.results : [];
            results.push(...batch);
            pages = Number.isFinite(data.pages) ? data.pages : 1;
            page += 1;

            if (results.length >= MAX_RESULTS) {
                await context.log({ step: 'result-cap', message: 'Reached the tl;dv 10,000 result ceiling; refine the date range (from/to) to retrieve more meetings.' });
                break;
            }
        } while (page <= pages);

        return results;
    },

    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
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
            }, { label: 'Items Count', value: 'count', schema: { type: 'integer' } }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

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
