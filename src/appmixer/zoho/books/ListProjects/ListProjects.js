'use strict';
const ZohoClient = require('../../ZohoClient');
const { sendArrayOutput } = require('../../zoho-commons');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return await this.getOutputPortOptions(context);
        }
        const { organization_id, customer_id, filter_by, sort_column, outputType } = context.messages.in.content;
        const params = {
            organization_id,
            customer_id,
            filter_by,
            sort_column
        };
        const zc = new ZohoClient(context);
        const projects = await zc.requestPaginated('GET', '/books/v3/projects', { dataKey: 'projects', params });

        await sendArrayOutput({ context, outputType, records: projects });
    },

    async getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;

        const schema = [
            { value: 'project_id', label: 'Project ID', type: 'string' },
            { value: 'project_name', label: 'Project Name', type: 'string' },
            { value: 'customer_id', label: 'Customer ID', type: 'string' },
            { value: 'customer_name', label: 'Customer Name', type: 'string' },
            { value: 'description', label: 'Description', type: 'string' },
            { value: 'status', label: 'Status', type: 'string' },
            { value: 'billing_type', label: 'Billing Type', type: 'string' },
            { value: 'rate', label: 'Rate', type: 'number' },
            { value: 'created_time', label: 'Created Time', type: 'string' },
            { value: 'has_attachment', label: 'Has Attachment', type: 'boolean' },
            { value: 'total_hours', label: 'Total Hours', type: 'string' },
            { value: 'billable_hours', label: 'Billable Hours', type: 'string' }
        ];

        if (outputType === 'item') {
            // schema to options. Drop type.
            const options = schema.map(option => ({ label: option.label, value: option.value }));

            return context.sendJson(options, 'out');
        }

        if (outputType === 'items') {
            // Transform schema to items schema.
            const propertiesFromOptions = schema.reduce((acc, option) => {
                acc[option.value] = { type: 'string', title: option.label };
                return acc;
            }, {});

            return context.sendJson([{
                label: 'Items', value: 'items', schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            ...propertiesFromOptions
                        }
                    }
                }
            }], 'out');
        }

        if (outputType === 'file') {        // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }

        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
};
