'use strict';

const pathModule = require('path');

/**
 * Authenticated Freshdesk API request via context.httpRequest (replaces the axios dependency).
 * Centralizes base URL, Basic auth (apiKey:X) and default JSON content type so every component
 * issues requests the same way. Returns the raw response ({ data, status, headers }) — the same
 * shape call sites previously consumed from axios.
 * @param {object} context - Appmixer component context
 * @param {object} opts
 * @param {string} [opts.method='GET'] - HTTP method
 * @param {string} opts.url - absolute URL, or a path starting with '/' appended to the /api/v2 base
 * @param {object} [opts.params] - query params
 * @param {*} [opts.data] - request body (plain object or a form-data instance)
 * @param {object} [opts.headers] - extra headers (e.g. formData.getHeaders())
 * @param {string} [opts.responseType] - e.g. 'stream'
 * @returns {Promise<object>} response with { data, status, headers }
 */
async function apiCall(context, { method = 'GET', url, params, data, headers = {}, responseType } = {}) {

    const baseUrl = `https://${context.auth.domain}.freshdesk.com/api/v2`;
    const targetUrl = /^https?:\/\//.test(url) ? url : `${baseUrl}${url}`;
    const credentials = Buffer.from(`${context.auth.apiKey}:X`).toString('base64');
    const hasContentType = Object.keys(headers).some(name => name.toLowerCase() === 'content-type');

    const options = {
        method,
        url: targetUrl,
        headers: {
            Authorization: `Basic ${credentials}`,
            ...(hasContentType ? {} : { 'Content-Type': 'application/json' }),
            ...headers
        }
    };
    if (params) options.params = params;
    if (data !== undefined) options.data = data;
    if (responseType) options.responseType = responseType;

    return context.httpRequest(options);
}

/**
 * Map a raw Freshdesk ticket into the output `fields` object emitted by the ticket triggers
 * (NewTicket / UpdatedTicket). Single source of truth for the trigger output shape so the
 * triggers and their test() methods can never drift apart.
 * @param {object} ticket - raw ticket from the Freshdesk API
 * @param {string[]} [normalizedEmbed] - embed fields requested by the component
 * @returns {object}
 */
function mapTicket(ticket, normalizedEmbed = []) {

    const fields = {
        id: ticket.id,
        createdAt: ticket.created_at,
        updatedAt: ticket.updated_at,
        dueBy: ticket.due_by,
        frDueBy: ticket.fr_due_by,
        subject: ticket.subject,
        type: ticket.type,
        source: ticket.source,
        sourceInfo: ticket.source_info || null,
        status: ticket.status,
        priority: ticket.priority,
        agentId: ticket.responder_id,
        groupId: ticket.group_id,
        emailConfigId: ticket.email_config_id,
        productId: ticket.product_id,
        tags: ticket.tags,
        customFields: ticket.custom_fields,
        ticketJson: ticket
    };

    if (normalizedEmbed.includes('requester') && ticket.requester) {
        fields.requesterId = ticket.requester.id;
        fields.requesterName = ticket.requester.name;
        fields.requesterEmail = ticket.requester.email;
    }
    if (normalizedEmbed.includes('description')) {
        fields.description = ticket.description_text;
    }

    return fields;
}

/**
 * Fetch one page of tickets and map them to the trigger output shape. Shared by the polling
 * triggers' tick() AND test() so the request, mapping and pagination parsing live in one place.
 * @param {object} context
 * @param {URLSearchParams|string} urlOrParams - query params (first page) or an absolute next-page URL
 * @param {string[]} [normalizedEmbed]
 * @returns {Promise<{ records: object[], nextUrl: (string|null) }>}
 */
async function requestTickets(context, urlOrParams, normalizedEmbed = []) {

    const url = typeof urlOrParams === 'string'
        ? urlOrParams
        : `/tickets?${urlOrParams.toString()}`;

    const res = await apiCall(context, { url });
    const records = (res.data || []).map(ticket => mapTicket(ticket, normalizedEmbed));
    const match = (res.headers.link || '').match(/<([^>]+)>;\s*rel="next"/);

    return { records, nextUrl: match ? match[1] : null };
}

/**
 * Remove undefined/null keys from body object.
 * Preserves falsy values like false, 0, and empty string.
 * @param {Object} body
 * @returns {Object}
 */
const trimUndefined = (body) => {

    const result = {};
    Object.keys(body).forEach(key => {
        if (body[key] !== undefined && body[key] !== null) {
            result[key] = body[key];
        }
    });
    return result;
};

/**
 * Normalize multiselect input (array or string) to array format.
 * Strings are treated as single values or comma-separated lists.
 * @param {string|string[]} input
 * @param {object} context
 * @param {string} fieldName
 * @returns {string[]}
 */
const normalizeMultiselectInput = (input, context, fieldName) => {

    if (Array.isArray(input)) {
        return input;
    } else if (typeof input === 'string') {
        // Handle single string value or comma-separated string
        return input.split(',').map(item => item.trim()).filter(item => item.length > 0);
    } else {
        throw new context.CancelError(`${fieldName} must be a string or an array`);
    }
};

/**
 * Convert an array of objects to CSV string.
 * @param {Object[]} array
 * @returns {string}
 */
function toCsv(array) {

    if (!array || array.length === 0) return '';
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(item =>
            Object.values(item).map(property => {
                if (typeof property === 'object') return JSON.stringify(property);
                return property;
            }).join(',')
        )
    ].join('\n');
}

/**
 * Send output based on outputType ('first', 'object', 'array', 'file').
 * @param {Object} opts
 * @param {Object} opts.context - Appmixer component context
 * @param {Object[]} opts.records - array of records to output
 * @param {string} opts.outputType - 'first' | 'object' | 'array' | 'file'
 * @param {string} opts.defaultPrefix - filename prefix used for file output
 */
async function sendArrayOutput({ context, records, outputType, defaultPrefix = 'freshdesk-export' }) {

    if (outputType === 'first') {
        if (records.length === 0) {
            throw new context.CancelError('No records available for first output type');
        }
        await context.sendJson(
            { ...records[0], index: 0, count: records.length },
            'out'
        );
    } else if (outputType === 'object') {
        for (let index = 0; index < records.length; index++) {
            await context.sendJson(
                { ...records[index], index, count: records.length },
                'out'
            );
        }
    } else if (outputType === 'array') {
        await context.sendJson({ result: records, count: records.length }, 'out');
    } else if (outputType === 'file') {
        const csvString = toCsv(records);
        const buffer = Buffer.from(csvString, 'utf8');
        const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
        const fileName = `${context.config.outputFilePrefix || defaultPrefix}-${componentName}.csv`;
        const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
        await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
        await context.sendJson({ fileId: savedFile.fileId }, 'out');
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
}

module.exports = {
    apiCall,
    mapTicket,
    requestTickets,
    trimUndefined,
    normalizeMultiselectInput,
    toCsv,
    sendArrayOutput
};
