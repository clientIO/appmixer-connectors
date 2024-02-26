'use strict';
const ZohoClient = require('../../ZohoClient');
const { sendArrayOutput } = require('../../zoho-commons');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return await this.getOutputPortOptions(context);
        }
        const { organization_id, showbalance, filter_by, sort_column, outputType } = context.messages.in.content;
        const params = {
            organization_id,
            showbalance,
            filter_by,
            sort_column
        };
        const zc = new ZohoClient(context);
        const chartofaccounts = await zc.requestPaginated(
            'GET',
            '/books/v3/chartofaccounts',
            { dataKey: 'chartofaccounts', params }
        );

        await sendArrayOutput({ context, outputType, records: chartofaccounts });
    },

    async getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;

        const schema = [
            { value: 'account_id', label: 'Account ID', type: 'string' },
            { value: 'account_name', label: 'Account Name', type: 'string' },
            { value: 'account_code', label: 'Account Code', type: 'string' },
            { value: 'account_type', label: 'Account Type', type: 'string' },
            { value: 'description', label: 'Description', type: 'string' },
            { value: 'is_user_created', label: 'Is User Created', type: 'boolean' },
            { value: 'is_system_account', label: 'Is System Account', type: 'boolean' },
            { value: 'is_active', label: 'Is Active', type: 'boolean' },
            { value: 'can_show_in_ze', label: 'Can Show In Ze', type: 'boolean' },
            { value: 'current_balance', label: 'Current Balance', type: 'number' },
            { value: 'parent_account_id', label: 'Parent Account ID', type: 'string' },
            { value: 'parent_account_name', label: 'Parent Account Name', type: 'string' },
            { value: 'depth', label: 'Depth', type: 'number' },
            { value: 'has_attachment', label: 'Has Attachment', type: 'boolean' },
            { value: 'is_child_present', label: 'Is Child Present', type: 'boolean' },
            { value: 'child_count', label: 'Child Count', type: 'string' },
            { value: 'documents', label: 'Currency Symbol', type: 'array' },
            { value: 'created_time', label: 'Created Time', type: 'string' },
            { value: 'is_standalone_account', label: 'Is Standalone Account', type: 'boolean' },
            { value: 'last_modified_time', label: 'Last Modified Time', type: 'string' }
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
