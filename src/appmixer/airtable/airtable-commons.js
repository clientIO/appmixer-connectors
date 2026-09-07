'use strict';
const pathModule = require('path');

module.exports = {

    // Expects standardized outputType: 'object', 'array', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'first', records = [] }) {
        if (outputType === 'first') {
            // First item found only.
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            // Into CSV file.
            const headers = Object.keys(records[0] || {});
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of records) {
                const values = headers.map(header => {
                    const val = record[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'airtable-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId, count: records.length }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    isAppmixerVariable(variable) {

        return variable?.startsWith('{{{') && variable?.endsWith('}}}');
    },

    // Single source of truth for the record -> output shape emitted by the webhook triggers.
    mapRecord(record) {
        return {
            id: record.id,
            createdTime: record.createdTime,
            ...record.fields
        };
    },

    // Read-only fetch of the newest record in a table, used by the triggers' test() (Flow Test Mode).
    // Airtable does not allow sorting by CREATED_TIME() via the `sort` param, so we fetch a small page
    // and pick the newest by the API-provided `createdTime`.
    async fetchLatestRecord(context, { baseId, tableId }) {
        const { accessToken } = context.auth;
        const { data } = await context.httpRequest({
            url: `https://api.airtable.com/v0/${baseId}/${tableId}`,
            method: 'GET',
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { pageSize: 100 }
        });
        const records = (data && data.records) || [];
        if (records.length === 0) {
            return null;
        }
        const newest = records.reduce((latest, current) => {
            return Date.parse(current.createdTime) > Date.parse(latest.createdTime) ? current : latest;
        });
        return this.mapRecord(newest);
    },

    transformFieldstoBodyFields(fields) {
        const bodyFields = {};

        Object.entries(fields).forEach(([key, value]) => {
            if (key === 'recordId') {
                return;
            }
            if (key.includes('|')) {
                const [baseKey, subKey] = key.split('|');
                if (subKey === 'multipleAttachments') {
                    bodyFields[baseKey] = Array.isArray(value.ADD)
                        ? value.ADD.map(item => ({
                            filename: item.fileName,
                            url: item.fileUrl
                        }))
                        : [];
                } else {
                    // Remove any leading characters until the first uppercase letter.
                    const match = subKey.match(/[A-Z].*$/);
                    const finalSubKey = match
                        ? match[0].charAt(0).toLowerCase() + match[0].slice(1)
                        : subKey;
                    if (!bodyFields[baseKey]) {
                        bodyFields[baseKey] = {};
                    }
                    bodyFields[baseKey][finalSubKey] = value;
                }
            } else {
                bodyFields[key] = value;
            }
        });

        return bodyFields;
    }
};
