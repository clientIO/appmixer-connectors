'use strict';

const pathModule = require('path');
const { BedrockAgentCoreClient } = require('@aws-sdk/client-bedrock-agentcore');
const { BedrockAgentCoreControlClient } = require('@aws-sdk/client-bedrock-agentcore-control');

const DEFAULT_PREFIX = 'agentcore-objects-export';

/**
 * Resolve the AWS region from (in order): explicit input, component properties,
 * the connected account's region field, finally the us-east-1 default.
 */
function resolveRegion(context) {
    const inContent = context.messages && context.messages.in && context.messages.in.content;
    return (inContent && inContent.region)
        || (context.properties && context.properties.region)
        || (context.auth && context.auth.region)
        || 'us-east-1';
}

function buildCredentials(context) {
    const credentials = {
        accessKeyId: context.auth.accessKeyId,
        secretAccessKey: context.auth.secretKey
    };
    if (context.auth.sessionToken) {
        credentials.sessionToken = context.auth.sessionToken;
    }
    return credentials;
}

/**
 * Create the AgentCore data-plane and control-plane SDK clients for the
 * connected account. The AWS SDK v3 handles SigV4 request signing internally.
 */
function init(context) {
    const region = resolveRegion(context);
    const credentials = buildCredentials(context);

    const dataClient = new BedrockAgentCoreClient({ region, credentials });
    const controlClient = new BedrockAgentCoreControlClient({ region, credentials });

    return { dataClient, controlClient, region };
}

/**
 * Aggregate a streaming InvokeAgentRuntime response body into a single string.
 * The SDK returns a stream (SdkStream) with transformToString(); older shapes
 * may return a Uint8Array which we fall back to buffering directly.
 */
async function streamToString(response) {
    if (!response) {
        return '';
    }
    if (typeof response.transformToString === 'function') {
        return response.transformToString();
    }
    return Buffer.from(response).toString('utf-8');
}

// ---------------------------------------------------------------------------
// outputType helpers (standard Appmixer pattern)
// ---------------------------------------------------------------------------

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

function getOutputPortOptions(context, outputType, itemSchema, { label }) {
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
            label: 'Items Count',
            value: 'count',
            schema: { type: 'integer' }
        }, {
            label,
            value: 'result',
            schema: { type: 'array', items: { type: 'object', properties: itemSchema } }
        }], 'out');
    }
    if (outputType === 'file') {
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
}

function toCsv(array) {
    if (!array.length) {
        return '';
    }
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(item =>
            Object.values(item).map(value =>
                typeof value === 'object' ? JSON.stringify(value) : value
            ).join(',')
        )
    ].join('\n');
}

// ---------------------------------------------------------------------------
// Trigger dedup helper
// ---------------------------------------------------------------------------

/**
 * Given a Set of known IDs and a new array of items, return:
 *  - diff: items not in the known set (empty on the very first run when known is null)
 *  - actual: all current IDs
 */
function getNewItems(known, items = [], idField = 'id') {
    const actual = items.map(item => item[idField]);
    const diff = known ? items.filter(item => !known.has(item[idField])) : [];
    return { diff, actual };
}

module.exports = {
    init,
    resolveRegion,
    streamToString,
    sendArrayOutput,
    getOutputPortOptions,
    getNewItems
};
