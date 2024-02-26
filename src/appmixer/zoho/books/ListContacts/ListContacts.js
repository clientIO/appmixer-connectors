'use strict';
const ZohoClient = require('../../ZohoClient');
const { sendArrayOutput, addFilterToParams } = require('../../zoho-commons');

/**
 * Component for fetching contact persons of a customer.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateContactPersonsOptions) {
            const customerId = context.messages.in.content.customer_id;

            return await this.getContactPersonsOptions(context, customerId);
        }

        if (context.properties.generateOutputPortOptions) {
            return await this.getOutputPortOptions(context);
        }

        const {
            organization_id,
            filter_by,
            search_text,
            sort_column,
            outputType
        } = context.messages.in.content;

        /** Search params sent to Zoho endpoint. */
        const params = {
            organization_id,
            filter_by,
            search_text,
            sort_column
        };

        // Add filters with variants to params.
        addFilterToParams(
            ['contact_name', 'company_name', 'first_name', 'last_name', 'address', 'email', 'phone'],
            params,
            context
        );

        const zc = new ZohoClient(context);
        const contacts = await zc.requestPaginated('GET', '/books/v3/contacts', { dataKey: 'contacts', params });

        await sendArrayOutput({ context, outputType, records: contacts });
    },

    /**
     * Returns options for Contact Persons output port depending on outputType.
     * @param {Context} context
     */
    async getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;

        // Schema for /contacts response. Simplified version than for CreateContact.
        // Used to generate output port options.
        const schema = [
            { value: 'contact_id', label: 'Contact ID', type: 'string' },
            { value: 'contact_name', label: 'Contact Name', type: 'string' },
            { value: 'company_name', label: 'Company Name', type: 'string' },
            { value: 'contact_type', label: 'Contact Type', type: 'string' },
            { value: 'status', label: 'Status', type: 'string' },
            { value: 'payment_terms', label: 'Payment Terms', type: 'string' },
            { value: 'payment_terms_label', label: 'Payment Terms Label', type: 'string' },
            { value: 'currency_id', label: 'Currency ID', type: 'string' },
            { value: 'currency_code', label: 'Currency Code', type: 'string' },
            { value: 'outstanding_receivable_amount', label: 'Outstanding Receivable Amount', type: 'number' },
            { value: 'unused_credits_receivable_amount', label: 'Unused Credits Receivable Amount', type: 'number' },
            { value: 'first_name', label: 'First Name', type: 'string' },
            { value: 'last_name', label: 'Last Name', type: 'string' },
            { value: 'email', label: 'Email', type: 'string' },
            { value: 'phone', label: 'Phone', type: 'string' },
            { value: 'mobile', label: 'Mobile', type: 'string' },
            { value: 'created_time', label: 'Created Time', type: 'string' },
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
    },

    /**
     * Get contact persons of a customer as options for dropdown.
     * @param {Context} context
     * @param {string} customerId
     * @returns {Promise<*>}
     */
    getContactPersonsOptions: async function(context, customerId) {

        const zc = new ZohoClient(context);
        const { contact_persons } = await zc.request('GET', '/books/v3/contacts/' + customerId + '/contactpersons');
        const options = contact_persons.map(contact_person => {
            return {
                label: contact_person.first_name + ' ' + contact_person.last_name,
                value: contact_person.contact_person_id
            };
        });

        return context.sendJson(options, 'out');
    }
};
