'use strict';
const ZohoClient = require('../../ZohoClient');
const { sendArrayOutput, addFilterToParams } = require('../../zoho-commons');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return await this.getOutputPortOptions(context);
        }
        const { organization_id, filter_by, sort_column, outputType } = context.messages.in.content;
        const params = {
            organization_id,
            filter_by,
            sort_column
        };

        // Add filters with variants to params.
        addFilterToParams(
            ['entry_number', 'reference_number', 'date', 'notes', 'total'],
            params,
            context
        );

        const zc = new ZohoClient(context);
        const journals = await zc.requestPaginated('GET', '/books/v3/journals', { dataKey: 'journals', params });

        await sendArrayOutput({ context, outputType, records: journals });
    },

    async getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;

        const schema = [
            { value: 'journal_id', label: 'Journal ID', type: 'string' },
            { value: 'journal_date', label: 'Journal Date', type: 'string' },
            { value: 'entry_number', label: 'Entry Number', type: 'string' },
            { value: 'reference_number', label: 'Reference Number', type: 'string' },
            { value: 'currency_id', label: 'Currency ID', type: 'string' },
            { value: 'notes', label: 'Notes', type: 'string' },
            { value: 'journal_type', label: 'Journal Type', type: 'string' },
            { value: 'entity_type', label: 'Entity Type', type: 'string' },
            { value: 'total', label: 'Total', type: 'number' },
            { value: 'bcy_total', label: 'BCY Total', type: 'number' },
            { value: 'custom_field', label: 'Custom Field', type: 'string' }
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
