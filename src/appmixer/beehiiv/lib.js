'use strict';

const pathModule = require('path');

const api = require('./api');

const DEFAULT_PREFIX = 'beehiiv-objects-export';

module.exports = {

    /**
     * Read-only fetch of the newest subscription matching the optional status/tier filters.
     * Shared by the webhook triggers' test() methods so Flow Test Mode can emit a real record
     * without registering a webhook or touching state. Uses the same subscriptions list endpoint
     * (api.Index5) the rest of the connector relies on.
     * @param {object} context
     * @param {object} [filters] - { status, tier } passed through to the list endpoint.
     * @returns {Promise<object|null>} The newest matching subscription record, or null.
     */
    async fetchLatestSubscription(context, { status, tier } = {}) {

        const { publicationId } = context.properties;
        if (!publicationId) {
            throw new context.CancelError('Publication ID is required!');
        }

        const response = await api.Index5.execute(context, {
            publicationId,
            status,
            tier,
            limit: 1,
            order_by: 'created',
            direction: 'desc'
        });

        const records = (response && response.data) || [];
        return records[0] || null;
    },

    /**
     * Reshape a subscription record into the exact webhook-event body the triggers' receive()
     * emits on the `out` port. All beehiiv subscription webhooks deliver `{ data: <subscription> }`
     * regardless of event type, so eventType only documents intent and does not alter the shape.
     * @param {object} record - The subscription record.
     * @param {string} eventType - The beehiiv event type (e.g. 'subscription.created').
     * @returns {object} `{ data }`
     */
    toWebhookShape(record, eventType) {
        return { data: record };
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
            const options = Object.keys(itemSchema).reduce((res, field) => {
                const schema = itemSchema[field];
                const { title: fieldLabel, ...schemaWithoutTitle } = schema;
                res.push({ label: fieldLabel, value: field, schema: schemaWithoutTitle });
                return res;
            }, [
                { label: 'Current Item Index', value: 'index', schema: { type: 'integer' } },
                { label: 'Items Count', value: 'count', schema: { type: 'integer' } }
            ]);
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
            }, {
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

function toCsv(array) {

    if (!array || array.length === 0) return '';
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(item => {
            return Object.values(item).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
}
