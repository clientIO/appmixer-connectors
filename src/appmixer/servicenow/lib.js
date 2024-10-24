'use strict';
const crypto = require('crypto');
const pathModule = require('path');

const IGNORE_PROPERTIES_INSPECTOR = ['sys_id'];

function getBasicAuth(username, password) {

    return Buffer.from(username + ':' + password).toString('base64');
}

function getCacheKey(obj) {
    // Convert the object to a JSON string
    const str = JSON.stringify(obj);

    // Create a hash using the SHA-256 algorithm
    const hash = crypto.createHash('sha256');
    hash.update(str);

    // Get the resulting hash as a hexadecimal string
    return hash.digest('hex');
}

async function callEndpointCached(context, options) {

    const key = getCacheKey({ ...options, token: context.auth.username + context.auth.password });

    const cached = await context.staticCache.get(key);
    if (cached) {
        return { data: cached };
    }

    const { data } = await callEndpoint(context, options);

    await context.staticCache.set(
        key,
        data,
        context.config.listBasesCacheTTL || (2 * 60 * 1000) // 120s
    );

    return { data };
}

async function callEndpoint(context, {
    method = 'GET',
    data = {},
    params,
    action
}) {

    const url = `https://${context.auth.instance}.service-now.com/api/now/${action}`;
    const options = {
        method,
        url,
        headers: {
            'User-Agent': 'Appmixer (info@appmixer.com)',
            'Authorization': ('Basic ' + getBasicAuth(context.auth.username, context.auth.password))
        },
        data,
        params
    };

    context.log({ step: 'Making request', options: { url, data, params } });
    return await context.httpRequest(options);
}

function isAppmixerVariable(variable) {

    return variable?.startsWith('{{{') && variable?.endsWith('}}}');
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

async function getTablesColumnsProperties(context, { tables = [] }) {

    const options = {
        action: 'table/sys_dictionary',
        params: {
            sysparm_query: `nameIN${tables.join(',')}`,
            sysparm_fields: 'mandatory,name,column_name,element,internal_type,sys_name,column_label,active,reference',
            sysparm_exclude_reference_link: false
        }
    };

    const { data } = await callEndpointCached(context, options);

    return data.result;
}

async function getColumns(context, { tableName }) {

    const tables = await getTableReferences(context, { tableName });
    return await getTablesColumnsProperties(context, { tables });
}

async function getTableReferences(context, { tableName, tableId }) {

    let tables = [];
    try {

        const options = tableId ?
            {
                action: `table/sys_db_object/${tableId}`,
                params: { sysparm_fields: 'name,super_class' }
            } :
            {
                action: 'table/sys_db_object',
                params: {
                    name: tableName,
                    sysparm_fields: 'name,super_class'
                }
            };

        const { data } = await callEndpointCached(context, options);

        const table = tableId ? data?.result : data?.result[0];

        if (table.super_class) {
            tables = tables.concat(await getTableReferences(context, { tableId: table.super_class.value }));
        }

        tables.push(table.name);
        return tables;
    } catch (e) {
        throw new context.CancelError(`Unable to retrieve the schema for the table "${tableName}".`);
    }
}

function toOutputScheme(context, columns, fields = '') {

    const types = {
        string: 'string',
        integer: 'number',
        boolean: 'boolean'
    };

    const fieldsItems = fields.split(',');
    const columnsFiltered = fields
        ? columns.filter(item => fieldsItems.includes(item.element) || item.element === 'sys_id') // always include the sys_id
        : columns;

    const uniq = {}; // temporary object for removing duplicities.
    const scheme = columnsFiltered.reduce((res, column) => {
        if (column.active === 'true' && column.element && !uniq[column.element]) {
            uniq[column.element] = true;
            res.push({
                label: column.column_label,
                value: column.element,
                schema: { type: types[column.internal_type.value] || 'string' }
            });
        }

        return res;
    }, []);

    return context.sendJson(scheme, 'out');
}

function toInspector(context, columns, fields = '') {
    const inputs = {};

    const types = {
        string: 'text',
        integer: 'number',
        boolean: 'toggle'
    };

    const fieldsItems = fields.split(',');
    const columnsFiltered = fields ? columns.filter(item => fieldsItems.includes(item.element)) : columns;

    columnsFiltered.forEach((column, index) => {
        if (column.active === 'true' && !IGNORE_PROPERTIES_INSPECTOR.includes(column.element)) {
            inputs[column.element] = {
                label: column.column_label,
                type: types[column.internal_type.value] || 'text',
                required: column.mandatory === 'true',
                tooltip: column.reference ? `Reference Table: ${column.reference.value}` : '',
                index,
                group: 'record'
            };
        }
    });

    const groups = {
        options: {
            label: 'Options',
            index: 1
        },
        record: {
            label: 'Record Properties',
            index: 2
        }
    };

    return context.sendJson({ inputs, groups }, 'out');
}

module.exports = {
    getBasicAuth,
    isAppmixerVariable,
    requestPaginated,
    sendArrayOutput,
    callEndpoint,
    toInspector,
    toOutputScheme,
    getColumns
};
