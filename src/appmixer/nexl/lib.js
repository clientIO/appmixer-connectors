'use strict';

const pathModule = require('path');

module.exports = {
    async makeApiCall({ context, method = 'GET', data }) {
        const url = `https://${context.auth.regionPrefix}.nexl.cloud/api/graphql`;
        return context.httpRequest({
            method,
            url,
            headers: {
                'content-type': 'application/json',
                authorization: `Bearer ${context.auth.apiKey}`
            },
            data
        });
    },

    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
        if (outputType === 'first') {
            await context.sendJson({ contact: records[0], index: 0, count: records.length }, outputPortName);
        } else if (outputType === 'object') {
            for (let index = 0; index < records.length; index++) {
                const contact = records[index];
                await context.sendJson({ contact, index, count: records.length }, outputPortName);
            }
        } else if (outputType === 'array') {
            await context.sendJson({ contacts: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {
            const headers = Object.keys(records[0] || {});
            const csvRows = [headers.join(',')];

            for (const record of records) {
                const values = headers.map(header => {
                    const val = record[header];
                    return `"${val}"`;
                });
                csvRows.push(values.join(','));
            }

            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'nexl-contacts-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId, count: records.length }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    }
};
