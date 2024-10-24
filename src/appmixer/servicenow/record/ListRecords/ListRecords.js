/* eslint-disable camelcase */
'use strict';

const { getBasicAuth, sendArrayOutput, requestPaginated, isAppmixerVariable } = require('../../lib');
const { getOutPortSchemaFromTableSchema } = require('../../commons-table');

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const {
            tableName,
            sysparm_display_value,
            sysparm_exclude_reference_link,
            sysparm_suppress_pagination_header,
            sysparm_fields,
            sysparm_query,
            sysparm_limit,
            sysparm_view,
            sysparm_query_category,
            sysparm_query_no_domain,
            sysparm_no_count,
            sysparm_offset,
            outputType
        } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return await this.getOutputPortOptions(context, outputType);
        }

        const options = {
            method: 'GET',
            url: `https://${context.auth.instance}.service-now.com/api/now/table/${tableName}`,
            headers: {
                'User-Agent': 'Appmixer (info@appmixer.com)',
                'Authorization': ('Basic ' + getBasicAuth(context.auth.username, context.auth.password))
            },
            params: {
                sysparm_display_value,
                sysparm_exclude_reference_link,
                sysparm_suppress_pagination_header,
                sysparm_fields,
                sysparm_query,
                sysparm_limit,
                sysparm_view,
                sysparm_query_category,
                sysparm_query_no_domain,
                sysparm_no_count,
                sysparm_offset
            }
        };

        const records = await requestPaginated(context, options);

        return sendArrayOutput({
            context,
            outputType,
            records
        });
    },

    async getOutputPortOptions(context, outputType) {

        const tableName = context.messages.in.content.tableName;
        const isVariable = isAppmixerVariable(tableName);

        if (outputType === 'item') {
            const itemSchemaDefault = [];
            const itemSchema = isVariable
                ? itemSchemaDefault
                : await getOutPortSchemaFromTableSchema(context, tableName, outputType);

            return context.sendJson(itemSchema, 'out');
        } else if (outputType === 'items') {
            const itemsSchemaDefault = [
                { label: 'Items', value: 'items', schema: { type: 'array', items: { type: 'object' } } }
            ];
            const itemsSchema = isVariable
                ? itemsSchemaDefault
                : await getOutPortSchemaFromTableSchema(context, tableName, outputType);

            return context.sendJson(itemsSchema, 'out');
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
