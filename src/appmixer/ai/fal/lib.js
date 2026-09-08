'use strict';

// fal.ai exposes four non-interchangeable base URLs (see the connector README).
const RUN_URL = 'https://fal.run';            // synchronous inference (blocks until done)
const QUEUE_URL = 'https://queue.fal.run';    // async queue: submit / status / result / cancel
const PLATFORM_URL = 'https://api.fal.ai/v1'; // platform APIs: models, storage, assets, meta
const REST_URL = 'https://rest.fal.ai';       // storage upload + JWKS

// Whitelisted base URLs for the MakeApiCall escape hatch.
const BASE_URLS = {
    'fal.run': RUN_URL,
    'queue.fal.run': QUEUE_URL,
    'api.fal.ai/v1': PLATFORM_URL,
    'rest.fal.ai': REST_URL
};

function authHeaders(context) {
    // fal uses the "Key " prefix, NOT "Bearer ".
    return {
        Authorization: `Key ${context.auth.apiKey}`
    };
}

// Map the returned validation detail out of fal's error payload for readable messages.
function extractDetail(data) {

    if (!data) {
        return '';
    }
    if (typeof data === 'string') {
        return data;
    }
    if (typeof data.detail === 'string') {
        return data.detail;
    }
    if (Array.isArray(data.detail)) {
        return data.detail
            .map((item) => {
                const loc = Array.isArray(item.loc) ? item.loc.join('.') : '';
                return loc ? `${loc}: ${item.msg}` : item.msg;
            })
            .filter(Boolean)
            .join('; ');
    }
    if (typeof data.message === 'string') {
        return data.message;
    }
    if (typeof data.error === 'string') {
        return data.error;
    }
    return '';
}

// Centralized error mapping. 401/403/422 become user-facing CancelErrors;
// 429 and 5xx are re-thrown unchanged so Appmixer can retry them.
function handleError(context, error) {

    const status = error && error.response && error.response.status;
    const detail = extractDetail(error && error.response && error.response.data);

    if (status === 401) {
        throw new context.CancelError('Invalid or revoked fal API key.');
    }
    if (status === 403) {
        throw new context.CancelError(
            'Access forbidden (403). This endpoint likely requires an ADMIN-scoped fal key, '
            + 'but the connection is using an API-scoped key. ' + (detail ? `Details: ${detail}` : '')
        );
    }
    if (status === 422) {
        throw new context.CancelError(
            'Validation error (422): the arguments do not match the model\'s input schema. '
            + (detail ? `Details: ${detail}` : '')
        );
    }
    // 429 (rate limit) and 5xx (server) are retryable: re-throw the original error.
    throw error;
}

// Thin wrapper around context.httpRequest that applies the central error mapping.
async function request(context, options) {

    try {
        return await context.httpRequest(options);
    } catch (error) {
        return handleError(context, error);
    }
}

// Build the advanced X-Fal-* request headers from user inputs.
function advancedHeaders({ priority, timeout, storeIO, noRetry } = {}) {

    const headers = {};
    if (priority) {
        headers['X-Fal-Queue-Priority'] = priority;
    }
    if (timeout !== undefined && timeout !== null && timeout !== '') {
        headers['X-Fal-Request-Timeout'] = String(timeout);
    }
    if (storeIO === false) {
        headers['X-Fal-Store-IO'] = '0';
    }
    if (noRetry === true) {
        headers['X-Fal-No-Retry'] = '1';
    }
    return headers;
}

// Log the billing/traceability headers fal returns on every inference call.
async function logInference(context, response) {

    const headers = (response && response.headers) || {};
    await context.log({
        step: 'fal-inference',
        requestId: headers['x-fal-request-id'],
        billableUnits: headers['x-fal-billable-units']
    });
}

// Parse a JSON "arguments" input that may arrive as an object or a string.
function parseArguments(context, value) {

    if (value === undefined || value === null || value === '') {
        return {};
    }
    if (typeof value === 'object') {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch (error) {
        throw new context.CancelError('Arguments must be a valid JSON object.');
    }
}

// Convert Appmixer key-value inspector rows into a plain object.
function kvToObject(rows) {

    if (!Array.isArray(rows)) {
        return {};
    }
    const result = {};
    for (const row of rows) {
        if (!row || typeof row.key !== 'string' || !row.key) {
            continue;
        }
        result[row.key] = row.value;
    }
    return result;
}

// Reduce an endpoint id to the owner/model pair that queue.fal.run's request
// routes accept. Submitting uses the FULL id (POST queue.fal.run/fal-ai/flux/schnell),
// but the /requests/... sub-paths are only routed on the first two segments —
// ".../fal-ai/flux/schnell/requests/<id>/status" answers 405 Method Not Allowed,
// while ".../fal-ai/flux/requests/<id>/status" works. This mirrors the status_url
// fal itself returns on submit.
function queueBaseId(endpointId) {
    return String(endpointId || '').split('/').filter(Boolean).slice(0, 2).join('/');
}

// Build the queue endpoint URLs for a given endpoint id + request id.
function queueUrls(endpointId, requestId) {
    const base = `${QUEUE_URL}/${queueBaseId(endpointId)}/requests/${requestId}`;
    return {
        statusUrl: `${base}/status`,
        responseUrl: base,
        cancelUrl: `${base}/cancel`
    };
}

// --- outputType helpers (Find / List components) ---

async function sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {

    if (outputType === 'first') {
        if (records.length === 0) {
            throw new context.CancelError('No records available for first output type');
        }
        await context.sendJson({ ...records[0], index: 0, count: records.length }, outputPortName);
    } else if (outputType === 'object') {
        for (let index = 0; index < records.length; index++) {
            await context.sendJson({ ...records[index], index, count: records.length }, outputPortName);
        }
    } else if (outputType === 'array') {
        await context.sendJson({ result: records, count: records.length }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
}

function getOutputPortOptions(context, outputType, itemSchema, { label, value }) {

    if (outputType === 'object' || outputType === 'first') {
        const options = Object.keys(itemSchema).reduce((res, field) => {
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

    return context.sendJson([{
        label,
        value,
        schema: {
            type: 'array',
            items: { type: 'object', properties: itemSchema }
        }
    }], 'out');
}

module.exports = {
    RUN_URL,
    QUEUE_URL,
    PLATFORM_URL,
    REST_URL,
    BASE_URLS,
    authHeaders,
    handleError,
    request,
    advancedHeaders,
    logInference,
    parseArguments,
    kvToObject,
    queueBaseId,
    queueUrls,
    sendArrayOutput,
    getOutputPortOptions
};
