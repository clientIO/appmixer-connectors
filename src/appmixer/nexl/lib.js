'use strict';

const pathModule = require('path');

// The region is typed by the user and becomes the request host, and the API token is sent to that
// host - so anything but a plain region prefix (letters, digits, hyphens) is rejected.
// Checked as typed, not normalized: components build their URLs from the stored value.
const REGION_PATTERN = /^[a-z0-9][a-z0-9-]*$/i;

/**
 * @param {string} regionPrefix - e.g. "nexl-360-latest" for nexl-360-latest.nexl.cloud
 * @return {string} https origin of the Nexl account
 * @throws Error
 */
function nexlOrigin(regionPrefix) {

    if (typeof regionPrefix !== 'string' || !REGION_PATTERN.test(regionPrefix)) {
        throw new Error('Invalid Nexl region. Enter the prefix only, e.g. "nexl-360-latest" for nexl-360-latest.nexl.cloud.');
    }
    return `https://${regionPrefix}.nexl.cloud`;
}

module.exports = {

    nexlOrigin,

    async makeApiCall({ context, method = 'GET', data }) {
        const url = `${nexlOrigin(context.auth.regionPrefix)}/api/graphql`;
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
