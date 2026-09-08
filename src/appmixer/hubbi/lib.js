'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'hubbi-objects-export';

// All Flows API endpoints live under {baseUrl}/Flows/Home/. Every call carries clientKey;
// hub-scoped calls also carry conversionKey. HubsStartWithData is the only POST.
const ENDPOINTS = {
    listSourceHubsWithPostData: 'ListSourceHubsWithPostData',
    listSourceHubsWithoutPostData: 'ListSourceHubsWithoutPostData',
    listTargetHubs: 'ListTargetHubs',
    sourceFields: 'SourceFields',
    targetFields: 'TargetFields',
    hubsStart: 'HubsStart',
    hubsStartWithData: 'HubsStartWithData'
};

const lib = {

    ENDPOINTS,

    baseUrl(context) {
        return ((context.auth && context.auth.baseUrl) || '').replace(/\/+$/, '');
    },

    /**
     * Perform a HubBI Flows API request. Adds the clientKey (and optional conversionKey) query
     * params and the Bearer token, and routes failures through rethrowHubbiError so the engine's
     * retry behaviour matches HubBI's semantics.
     * @param {object} context
     * @param {object} options - { method, endpoint, conversionKey, body, params }
     * @returns {Promise<*>} The response body.
     */
    async hubbiRequest(context, { method = 'GET', endpoint, conversionKey, body, params = {} } = {}) {

        const query = { clientKey: context.auth.clientKey, ...params };
        if (conversionKey) {
            query.conversionKey = conversionKey;
        }

        const request = {
            method,
            url: `${lib.baseUrl(context)}/Flows/Home/${endpoint}`,
            params: query,
            headers: {
                Authorization: `Bearer ${context.auth.token}`,
                'Content-Type': 'application/json'
            }
        };
        if (body !== undefined) {
            request.data = body;
        }

        try {
            const response = await context.httpRequest(request);
            return response.data;
        } catch (err) {
            return lib.rethrowHubbiError(context, err);
        }
    },

    /**
     * Override the engine's default retry classification for two HubBI-specific statuses:
     *  - 409 Conflict: rethrown as a plain Error so the engine treats it as unknown and RETRIES
     *    (it would otherwise be dropped as a permanent client error).
     *  - 423 Locked: converted to CancelError so the engine does NOT retry (it would otherwise
     *    retry indefinitely).
     * Everything else is rethrown unchanged.
     */
    rethrowHubbiError(context, err) {

        const status = err && err.response && err.response.status;
        const detail = (err && err.response && err.response.data) || (err && err.message) || '';

        if (status === 409) {
            throw new Error(`HubBI returned 409 Conflict: ${lib.stringifyDetail(detail)}`);
        }
        if (status === 423) {
            throw new context.CancelError(`HubBI returned 423 Locked: ${lib.stringifyDetail(detail)}`);
        }
        throw err;
    },

    stringifyDetail(detail) {
        if (detail === null || detail === undefined) {
            return '';
        }
        return typeof detail === 'string' ? detail : JSON.stringify(detail);
    },

    async listHubs(context, endpoint) {
        const data = await lib.hubbiRequest(context, { method: 'GET', endpoint });
        return lib.normalizeHubs(data);
    },

    async getFields(context, endpoint, conversionKey) {
        const data = await lib.hubbiRequest(context, { method: 'GET', endpoint, conversionKey });
        return lib.normalizeFields(data);
    },

    // HubBI is a .NET service; list/field payloads may arrive PascalCase or wrapped. Normalize
    // defensively so a shape change (this API has changed under us before) is less likely to break
    // the pickers.
    normalizeHubs(data) {
        const arr = Array.isArray(data)
            ? data
            : (data && (data.hubs || data.Hubs || data.result || data.data)) || [];
        return arr
            .map(item => ({
                name: item.name || item.Name || item.hubName || item.HubName || item.label || item.Label || '',
                conversionKey: item.conversionKey || item.ConversionKey || item.key || item.Key || item.id || item.Id || ''
            }))
            .filter(hub => hub.conversionKey);
    },

    normalizeFields(data) {
        const arr = Array.isArray(data)
            ? data
            : (data && (data.fields || data.Fields || data.result || data.data)) || [];
        return arr
            .map(item => {
                const name = item.name || item.Name || item.fieldName || item.FieldName || '';
                const netType = item.type || item.Type || item.dataType || item.DataType || item.netType || item.NetType || 'String';
                const required = !!(item.required || item.Required || item.isRequired || item.IsRequired);
                const mapped = lib.mapFieldType(netType);
                return {
                    name,
                    type: netType,
                    required,
                    inspectorType: mapped.inspectorType,
                    schemaType: mapped.schemaType,
                    schemaFormat: mapped.schemaFormat
                };
            })
            .filter(field => field.name);
    },

    /**
     * Map a .NET type name to an Appmixer inspector type and a JSON Schema type (+ optional
     * format), so e.g. a DateTime field renders as a date-time picker. Unknown types degrade to
     * string.
     */
    mapFieldType(dotNetType) {

        const type = (dotNetType || '').toString().trim();

        switch (type) {
            case 'Byte':
            case 'SByte':
            case 'Int16':
            case 'Int32':
            case 'Int64':
            case 'UInt16':
            case 'UInt32':
            case 'UInt64':
                return { inspectorType: 'number', schemaType: 'integer' };
            case 'Single':
            case 'Float':
            case 'Double':
            case 'Decimal':
                return { inspectorType: 'number', schemaType: 'number' };
            case 'Boolean':
            case 'Bool':
                return { inspectorType: 'toggle', schemaType: 'boolean' };
            case 'Date':
            case 'DateTime':
            case 'DateTimeOffset':
                return { inspectorType: 'date-time', schemaType: 'string', schemaFormat: 'date-time' };
            case 'Guid':
            case 'Char':
            case 'String':
            default:
                return { inspectorType: 'text', schemaType: 'string' };
        }
    },

    // Build inspector inputs (one per field) for a dynamically generated record form.
    fieldsToInspectorInputs(fields, startIndex = 10) {
        const inputs = {};
        fields.forEach((field, i) => {
            const input = {
                type: field.inspectorType,
                label: field.name,
                index: startIndex + i,
                tooltip: `HubBI source field "${field.name}" (${field.type}).`
            };
            if (field.required) {
                input.required = true;
            }
            inputs[field.name] = input;
        });
        return inputs;
    },

    // Matching JSON Schema properties for the dynamically generated inputs above.
    fieldsToInspectorSchema(fields) {
        const properties = {};
        fields.forEach(field => {
            const property = { type: field.schemaType };
            if (field.schemaFormat) {
                property.format = field.schemaFormat;
            }
            properties[field.name] = property;
        });
        return properties;
    },

    // Per-field option list for a trigger's dynamic output port (value = field name).
    fieldsToOutPortOptions(fields) {
        if (!fields.length) {
            return [{
                label: 'Records',
                value: 'records',
                schema: { type: 'array', items: { type: 'object' } }
            }];
        }
        return fields.map(field => {
            const schema = { type: field.schemaType, example: lib.sampleValue(field) };
            if (field.schemaFormat) {
                schema.format = field.schemaFormat;
            }
            return { label: field.name, value: field.name, schema };
        });
    },

    // A fixed, plausible value per mapped type — used by NewHubEvent.test() to synthesize a
    // sample record (HubBI exposes no endpoint for past events).
    sampleValue(field) {
        if (field.schemaType === 'integer') {
            return 42;
        }
        if (field.schemaType === 'number') {
            return 3.14;
        }
        if (field.schemaType === 'boolean') {
            return true;
        }
        if (field.schemaFormat === 'date-time') {
            return '2025-01-15T10:30:00Z';
        }
        if (field.type === 'Guid') {
            return '00000000-0000-0000-0000-000000000000';
        }
        return 'sample';
    },

    synthesizeRecord(fields) {
        const record = {};
        fields.forEach(field => {
            record[field.name] = lib.sampleValue(field);
        });
        return record;
    },

    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {

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
            const fileName = `${(context.config && context.config.outputFilePrefix) || DEFAULT_PREFIX}-${componentName}.csv`;
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
    if (!array || array.length === 0) {
        return '';
    }
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

module.exports = lib;
