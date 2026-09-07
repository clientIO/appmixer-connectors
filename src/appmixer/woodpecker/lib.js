'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'woodpecker-objects-export';

// Woodpecker REST API base. Note: the API mixes /v1 (prospects) and /v2 (campaigns,
// mailboxes, webhooks, tasks) paths, so each component appends the full versioned path.
const API_BASE_URL = 'https://api.woodpecker.co/rest';

module.exports = {

    API_BASE_URL,

    // Authentication header used by every request. Woodpecker keys are passed as `x-api-key`.
    getHeaders(context) {
        return {
            'x-api-key': context.auth.apiKey,
            'Content-Type': 'application/json'
        };
    },

    // Builds a single, realistic example payload for a webhook trigger's test(context)
    // (Flow Test Mode). Woodpecker exposes no REST endpoint that lists past webhook events,
    // so we read the newest prospect (read-only) and reshape it into the same event payload
    // shape that routes.js delivers to the trigger. Returns null when no example is available
    // so the caller can throw and let the engine fallback chain (schema samples) take over.
    async fetchLatestExample(context, eventType, extra = {}) {
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${API_BASE_URL}/v1/prospects`,
            headers: module.exports.getHeaders(context)
        });

        const prospects = Array.isArray(data) ? data : (data.prospects || data.data || []);
        const prospect = prospects[0];
        if (!prospect) {
            return null;
        }

        return {
            'event': eventType,
            'company_id': context.profileInfo && context.profileInfo.companyId,
            'campaign_id': prospect.campaign_id || prospect.campaignId || null,
            'prospect': {
                'id': prospect.id,
                'email': prospect.email,
                'first_name': prospect.first_name,
                'last_name': prospect.last_name,
                'company': prospect.company
            },
            'timestamp': new Date().toISOString(),
            ...extra
        };
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
