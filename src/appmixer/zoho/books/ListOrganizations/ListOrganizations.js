'use strict';
const ZohoClient = require('../../ZohoClient');
const { sendArrayOutput } = require('../../zoho-commons');

/**
 * Component for fetching organizations.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return await this.getOutputPortOptions(context);
        }

        const zc = new ZohoClient(context);
        const { organizations } = await zc.request('GET', '/books/v3/organizations');

        const { outputType } = context.messages.in.content;

        await sendArrayOutput({ context, outputType, records: organizations });
    },

    async getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;

        const schema = [
            { value: 'organization_id', label: 'Organization ID', type: 'string' },
            { value: 'name', label: 'Name', type: 'string' },
            { value: 'contact_name', label: 'Contact Name', type: 'string' },
            { value: 'email', label: 'Email', type: 'string' },
            { value: 'is_default_org', label: 'Is default org', type: 'boolean' },
            { value: 'language_code', label: 'Language Code', type: 'string' },
            { value: 'fiscal_year_start_month', label: 'Fiscal Year Start Month', type: 'string' },
            { value: 'account_created_date', label: 'Account Created Date', type: 'string' },
            { value: 'time_zone', label: 'Time Zone', type: 'string' },
            { value: 'is_org_active', label: 'Is Org Active', type: 'boolean' },
            { value: 'currency_id', label: 'Currency ID', type: 'string' },
            { value: 'currency_code', label: 'Currency Code', type: 'string' },
            { value: 'currency_symbol', label: 'Currency Symbol', type: 'string' },
            { value: 'currency_format', label: 'Currency Format', type: 'string' },
            { value: 'price_precision', label: 'Price Precision', type: 'number' }
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
