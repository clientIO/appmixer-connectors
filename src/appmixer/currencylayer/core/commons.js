'use strict';
const pathModule = require('path');
module.exports = {
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
                    const val = record[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'currencylayer-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },
    async fetchData(context, endpoint, params = {}) {
        let retryCount = 0;
        let response;
        const REQUEST_URL = `${context.auth.protocol}://api.currencylayer.com/${endpoint}`;
        const urlParams = new URLSearchParams({
            access_key: context.auth.apiKey,
            ...params
        }).toString();
        // Retry up to 3 times
        while (retryCount < 3) {
            response = await context.httpRequest({
                method: 'GET',
                url: `${REQUEST_URL}?${urlParams}`,
                json: true
            });
            // If the API call is successful, break out of the loop
            if (response.data.success) {
                break;
            }
            // If the error code is 106, wait for 5 seconds before retrying
            if (response.data.error?.code === 106) {
                retryCount++;
                if (retryCount < 3) {
                    await new Promise(resolve => setTimeout(resolve, 5000)); // 5 seconds delay
                }
            } else {
                // If the error is not 106, stop retrying and throw an error
                throw new context.CancelError(`API returned error: ${response.data.error?.code || 'unknown error'}`);
            }
        }
        return response.data;
    }
};
