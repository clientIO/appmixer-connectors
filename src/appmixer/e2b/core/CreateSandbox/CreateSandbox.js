'use strict';

const lib = require('../../lib');

const parseJsonInput = (context, value, label) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    if (typeof value === 'object') {
        return value;
    }
    try {
        return JSON.parse(value);
    } catch (err) {
        throw new context.CancelError(`${label} must be a valid JSON object.`);
    }
};

// The key-value inspector produces an array of { key, value } rows
// (possibly wrapped in { ADD: [...] }). Also accept a plain object or
// a JSON string for backward compatibility.
const parseKeyValueInput = (context, value, label) => {
    if (value === undefined || value === null || value === '') {
        return undefined;
    }
    const rows = Array.isArray(value) ? value : (value && Array.isArray(value.ADD) ? value.ADD : null);
    if (rows) {
        const out = {};
        for (const row of rows) {
            if (!row || typeof row !== 'object' || !row.key) continue;
            out[row.key] = row.value;
        }
        return Object.keys(out).length ? out : undefined;
    }
    return parseJsonInput(context, value, label);
};

module.exports = {

    async receive(context) {

        const { templateID, timeout, metadata, envVars } = context.messages.in.content;

        const data = {
            templateID: templateID || 'base'
        };

        if (timeout) {
            data.timeout = timeout;
        }

        const parsedMetadata = parseJsonInput(context, metadata, 'Metadata');
        if (parsedMetadata) {
            data.metadata = parsedMetadata;
        }

        const parsedEnvVars = parseKeyValueInput(context, envVars, 'Environment Variables');
        if (parsedEnvVars) {
            data.envVars = parsedEnvVars;
        }

        const { data: responseData } = await context.httpRequest({
            method: 'POST',
            url: `${lib.BASE_URL}/sandboxes`,
            headers: lib.authHeaders(context),
            data
        });

        return context.sendJson(responseData, 'out');
    }
};
