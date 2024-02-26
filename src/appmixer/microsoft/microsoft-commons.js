'use strict';

const request = require('request-promise');
const pathModule = require('path');

const BASE_URL = 'https://graph.microsoft.com/v1.0';

// TODO: Move to appmixer-lib
function getCSVValue(value) {
    if (typeof value === 'object') {
        try {
            value = JSON.stringify(value);
            // Make stringified JSON valid CSV value.
            value = value.replace(/"/g, '""');
        } catch (e) {
            value = '';
        }
    }
    return `"${value}"`;
}

module.exports = {

    /**
     * @deprecated, use the msGraphRequest instead
     */
    request(endpoint, method, accessToken, qs, body) {

        const url = endpoint.indexOf('https://') > -1 ? endpoint : BASE_URL + endpoint;

        return request({
            method,
            url,
            auth: { bearer: accessToken },
            qs,
            json: true,
            body,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });
    },

    post(endpoint, accessToken, body) {

        return this.request(endpoint, 'POST', accessToken, undefined, body);
    },

    async msGraphRequest(context, {
        method = 'GET',
        headers = {},
        data,
        action,
        responseType = 'json'
    }) {

        const url = action.indexOf('https://') > -1 ? action : BASE_URL + action;

        return await context.httpRequest({
            method,
            url,
            data,
            responseType,
            headers: {
                'Authorization': `Bearer ${ context.auth.accessToken }`,
                ...headers
            }
        });
    },

    put(endpoint, accessToken, body) {

        return this.request(endpoint, 'PUT', accessToken, undefined, body);
    },

    patch(endpoint, accessToken, body) {

        return this.request(endpoint, 'PATCH', accessToken, undefined, body);
    },

    get(endpoint, accessToken, qs) {

        return this.request(endpoint, 'GET', accessToken, qs);
    },

    delete(endpoint, accessToken, body) {

        return this.request(endpoint, 'DELETE', accessToken, undefined, body);
    },

    /**
     * Catch errors from Microsoft API and set the message to something helpful
     * This message will be logged by Logstash and can be inspected on insights
     * @param {Function} asyncFunc
     * @param {string} [customMessage]
     * @return {Promise<*>}
     */
    async formatError(asyncFunc, customMessage = null) {
        try {
            return await asyncFunc();
        } catch (err) {

            /*
                Extract error message from response. According to the API docs,
                all error responses should follow this structure, but we keep this as a
                failsafe
             */
            const errMsg = (((err.error || {} ).error || {}).message || null);
            if (errMsg) {
                let message = err.error.error.message;
                if (customMessage && err.statusCode === 404) {
                    message = customMessage;
                }
                err.message = `${err.statusCode} - ${message}`;
            }
            throw err;
        }
    },

    // TODO: Move to appmixer-lib
    // Expects standardized outputType: 'object', 'array', 'file'
    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
        if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records }, outputPortName);
        } else if (outputType === 'file') {
            // Into CSV file.
            const headers = Object.keys(records[0] || {});
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of records) {
                const values = headers.map(header => {
                    return getCSVValue(record[header]);
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'microsoft-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    isAppmixerVariable(variable) {
        return variable?.startsWith('{{{') && variable?.endsWith('}}}');
    },

    getDeltaLink({
                     driveId,
                     parentId,
                     parentPath
                 }) {

        if (parentId) {
            return `/drives/${driveId}/items/${parentId}/delta`;
        }

        if (parentPath) {
            return `/drives/${driveId}/root:/${parentPath}/delta`;
        }

        return `/drives/${driveId}/items/root/delta`;
    }
};
