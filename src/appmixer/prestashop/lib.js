'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'prestashop-objects-export';

/**
 * Issue an authenticated request against the PrestaShop Webservice API.
 * The Webservice uses HTTP Basic auth with the Webservice key as the username and an empty
 * password. JSON output is requested via the `output_format` query parameter.
 * @param {object} context - Appmixer component context
 * @param {object} opts
 * @param {string} [opts.method='GET'] - HTTP method
 * @param {string} opts.path - resource path starting with '/', e.g. '/customers/1'
 * @param {object} [opts.params] - extra query parameters
 * @param {string} [opts.data] - request body (XML string for create/update)
 * @param {object} [opts.headers] - extra headers
 * @returns {Promise<object>} parsed JSON response body
 */
async function psRequest(context, { method = 'GET', path, params = {}, data, headers = {} } = {}) {

    const shopUrl = (context.auth.shopUrl || '').replace(/\/+$/, '');
    const credentials = Buffer.from(`${context.auth.apiKey}:`).toString('base64');

    const options = {
        method,
        url: `${shopUrl}/api${path}`,
        params: { output_format: 'JSON', ...params },
        headers: {
            'Authorization': `Basic ${credentials}`,
            ...headers
        }
    };
    if (data !== undefined) {
        options.data = data;
    }

    const response = await context.httpRequest(options);
    return response.data;
}

/**
 * Build a minimal PrestaShop Webservice XML payload for a single resource.
 * @param {string} resource - resource wrapper name, e.g. 'customer_message'
 * @param {object} fields - flat map of field name -> value
 * @returns {string} XML string
 */
function buildResourceXml(resource, fields) {

    const escapeCdata = (value) => String(value).split(']]>').join(']]]]><![CDATA[>');

    const body = Object.keys(fields)
        .filter(key => fields[key] !== undefined && fields[key] !== null)
        .map(key => `    <${key}><![CDATA[${escapeCdata(fields[key])}]]></${key}>`)
        .join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<prestashop xmlns:xlink="http://www.w3.org/1999/xlink">
  <${resource}>
${body}
  </${resource}>
</prestashop>`;
}

/**
 * Compute the set difference between the previously known ids and the current items.
 * @param {Set<string>|null} known - previously seen ids, or null on the first run
 * @param {object[]} items - current items
 * @param {string} key - id field name
 * @returns {{ diff: object[], actual: string[] }}
 */
function getNewItems(known, items, key) {

    const actual = [];
    const diff = [];
    for (const item of items || []) {
        const id = String(item[key]);
        actual.push(id);
        if (known && !known.has(id)) {
            diff.push(item);
        }
    }
    return { diff, actual };
}

async function sendArrayOutput({
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
}

function getOutputPortOptions(context, outputType, itemSchema, { label, value = 'result' }) {

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

const toCsv = (array) => {

    if (!array || array.length === 0) return '';
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

module.exports = {
    psRequest,
    buildResourceXml,
    getNewItems,
    sendArrayOutput,
    getOutputPortOptions,
    toCsv
};
