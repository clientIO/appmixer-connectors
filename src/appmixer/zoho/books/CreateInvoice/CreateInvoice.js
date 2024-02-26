'use strict';
const ZohoClient = require('../../ZohoClient');

module.exports = {

    async receive(context) {

        /** Properties that are not to be in `data` object. */
        const ignoredDataProperties = ['ignore_auto_number_generation', 'send', 'organization_id'];
        /** Nested array or objects that don't have propper UI in Inspector. */
        const complexDataProperties = ['contact_persons', 'custom_fields', 'line_items', 'time_entry_ids'];
        /** Generated dynamically from `context.messages.in.content`. Only the fields that are to be updated need to be specified. */
        const data = Object.keys(context.messages.in.content).reduce((acc, key) => {
            if (!ignoredDataProperties.includes(key)) {
                // All this will be passed as data to ZOHO.

                // Handle the complex data properties.
                if (complexDataProperties.includes(key)) {
                    // Parse JSON from text field to JS object/array.
                    const jsonStringValue = context.messages.in.content[key];
                    if (jsonStringValue) {
                        try {
                            acc[key] = JSON.parse(jsonStringValue);
                        } catch (e) {
                            // If the value is not a valid JSON, just pass it as is.
                            acc[key] = jsonStringValue;
                        }
                    }
                } else {
                    // All other values are passed as is.
                    acc[key] = context.messages.in.content[key];
                }
            }
            return acc;
        }, {});

        const params = { organization_id: context.messages.in.content.organization_id };
        if (context.messages.in.content.ignore_auto_number_generation !== undefined) {
            params.ignore_auto_number_generation = context.messages.in.content.ignore_auto_number_generation;
        }
        if (context.messages.in.content.send !== undefined) {
            params.send = context.messages.in.content.send;
        }

        if (Object.keys(data).length === 0) {
            // This will result in ZOHO response: { code: 11, message: 'The parameter JSONString is mandatory.' }
            throw new context.CancelError('No data to create invoice with.');
        }

        const zc = new ZohoClient(context);
        const { invoice } = await zc.request('POST', '/books/v3/invoices', { data, params });

        return context.sendJson(invoice, 'out');
    }
}
