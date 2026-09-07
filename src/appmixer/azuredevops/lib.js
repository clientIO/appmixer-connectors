'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'azuredevops-objects-export';

module.exports = {

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
    },

    /**
     * Expand dot-notation keys in an object into nested objects.
     * Azure DevOps API returns { fields: { "System.Title": "value" } } where
     * "System.Title" is a single key with a dot. Appmixer resolves variable
     * paths like $.comp.out.fields.System.Title by traversing nested keys.
     * This function converts dotted keys into nested structures so the engine
     * can resolve them properly.
     */
    expandDottedKeys(obj) {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
            return obj;
        }
        const result = {};
        for (const key of Object.keys(obj)) {
            const val = obj[key];
            if (key.includes('.')) {
                const parts = key.split('.');
                let current = result;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
                        current[parts[i]] = {};
                    }
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = (val && typeof val === 'object' && !Array.isArray(val))
                    ? module.exports.expandDottedKeys(val)
                    : val;
            } else {
                result[key] = (val && typeof val === 'object' && !Array.isArray(val))
                    ? module.exports.expandDottedKeys(val)
                    : val;
            }
        }
        return result;
    },

    /**
     * Compare a set of known item IDs against current items and return the diff.
     * @param {Set|null} known - Previously known IDs
     * @param {Array} items - Current items from the API
     * @param {string} idField - Field name to use as unique ID
     * @returns {{ diff: Array, actual: Array }} New items and all current IDs
     */
    getNewItems(known, items, idField) {
        const diff = [];
        const actual = [];

        for (const item of items) {
            const id = item[idField];
            actual.push(id);
            if (known && !known.has(id)) {
                diff.push(item);
            }
        }

        return { diff, actual };
    },

    /**
     * Fetch the single newest work item (read-only) for Flow Test Mode, honoring the
     * trigger's organization/projectId and optional workItemType filter. `orderField`
     * is the System field to sort by descending (CreatedDate for new, ChangedDate for
     * updated). Returns the raw API work item (dotted field keys) or null.
     */
    async fetchLatestWorkItem(context, { orderField }) {
        const api = require('./api');
        const { organization, projectId, workItemType } = context.properties;
        if (!organization || !projectId) {
            throw new context.CancelError('Organization and Project ID are required!');
        }
        // SELECT TOP 1 — only the newest work item is needed, so don't fetch every matching ID.
        let wiqlQuery = 'SELECT TOP 1 [System.Id] FROM WorkItems WHERE [System.TeamProject] = @project';
        if (workItemType) {
            // Escape single quotes so a value containing one cannot break out of the WIQL string
            // literal (prevents a broken query and WIQL injection).
            const safeWorkItemType = workItemType.replace(/'/g, '\'\'');
            wiqlQuery += ` AND [System.WorkItemType] = '${safeWorkItemType}'`;
        }
        wiqlQuery += ` ORDER BY [${orderField}] DESC`;
        const data = await api.FindWorkItems.execute(context, { organization, project: projectId, wiqlQuery });
        return (data.value || [])[0] || null;
    }
};

function toCsv(array) {
    if (!array || array.length === 0) return '';
    const headers = Object.keys(array[0]);
    return [
        headers.join(','),
        ...array.map(row => Object.values(row).map(val => {
            if (typeof val === 'object') return JSON.stringify(val);
            return val;
        }).join(','))
    ].join('\n');
}
