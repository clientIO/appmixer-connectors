'use strict';

const pathModule = require('path');


function getBasicAuth(username, password) {

    return Buffer.from(username + ':' + password).toString('base64');
}

function isAppmixerVariable(variable) {

    return variable && variable.startsWith('{{{') && variable.endsWith('}}}');
}

async function requestPaginated(context, { method, url, data = {}, headers = {}, params = {} } = {}) {

    const pageSize = 1000; // ServiceNow default is 1000
    const countLimit = params.sysparm_limit || 10000;
    let records = [];
    let hasMoreRecords = false;
    let page = 0;

    do {
        page += 1;
        params.sysparm_offset = (page - 1) * pageSize;

        const options = { method, url, data, headers, params };
        context.log({ step: 'Requesting paginated data', options });
        const response = await context.httpRequest(options);

        if (response?.data?.result) {
            const results = response.data.result;
            // ServiceNow API returns info on paging in headers, see: https://developer.servicenow.com/print_page.do?release=tokyo&category=null&identifier=c_TableAPI&module=api
            // We are using only `x-total-count` header to determine if there are more records. Not using Link header.
            // Note that `x-total-count` header is set to sysparm_limit if sysparm_no_count=true is used.
            const { 'x-total-count': xTotalCount } = response.headers;
            if (xTotalCount) {
                hasMoreRecords = (page * pageSize) < xTotalCount;
            }
            records = records.concat(results);
        }
    } while (hasMoreRecords && records.length < countLimit);

    return records;
}

// TODO: Move to appmixer-lib
// Expects standardized outputType: 'item', 'items', 'file'
async function sendArrayOutput({ context, outputPortName = 'out', outputType = 'items', records = [] }) {
    if (outputType === 'item') {
        // One by one.
        await context.sendArray(records, outputPortName);
    } else if (outputType === 'items') {
        // All at once.
        await context.sendJson({ items: records }, outputPortName);
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
        const fileName = `${context.config.outputFilePrefix || 'servicenow-export'}-${componentName}.csv`;
        const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
        await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
        await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
}

module.exports = {
    getBasicAuth,
    isAppmixerVariable,
    requestPaginated,
    sendArrayOutput
};
