'use strict';

const crypto = require('crypto');
const pathModule = require('path');

const DEFAULT_PREFIX = 'gohighlevel-export';

// HighLevel signs every marketplace webhook payload with this Ed25519 key and sends the
// base64 signature in the `X-GHL-Signature` header. The legacy RSA-SHA256 `X-WH-Signature`
// header is deprecated as of September 1, 2026 and must not be relied on any more.
// https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide
const WEBHOOK_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

module.exports = {

    // Header name as it appears on the lower-cased request headers object.
    WEBHOOK_SIGNATURE_HEADER: 'x-ghl-signature',

    /**
     * Verify the Ed25519 `X-GHL-Signature` header HighLevel sends with every webhook payload.
     * `rawBody` must be the untouched request body (Buffer or string), not a re-serialized
     * object, otherwise the signature will never match. Returns `true` only on a valid
     * signature, so callers can reject the request on `false`.
     */
    verifyWebhookSignature({ rawBody, signature }) {

        if (!rawBody || !signature || signature === 'N/A') return false;

        try {
            return crypto.verify(
                null,
                Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8'),
                WEBHOOK_PUBLIC_KEY,
                Buffer.from(signature, 'base64')
            );
        } catch (e) {
            return false;
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
                throw new context.CancelError('No records found');
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
            return headers.map(header => {
                const val = item[header];
                if (typeof val === 'object') {
                    return `"${JSON.stringify(val).replace(/"/g, '""')}"`;
                }
                return `"${String(val ?? '').replace(/"/g, '""')}"`;
            }).join(',');
        })
    ].join('\n');
}
