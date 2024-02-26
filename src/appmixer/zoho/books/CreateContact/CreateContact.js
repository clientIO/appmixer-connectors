'use strict';
const ZohoClient = require('../../ZohoClient');

module.exports = {

    async receive(context) {

        /** Properties that are not to be in `data` object. */
        const ignoredDataProperties = ['organization_id'];
        const ignoredDataPropertiesPrefixes = ['billing_address', 'shipping_address', 'default_templates'];
        /** Arrays */
        const complexDataProperties = ['contact_persons'];

        // TODO: Add `custom_fields` to `complexDataProperties`.
        // TODO: Add and process tags.

        /** Generated dynamically from `context.messages.in.content`. Only the fields that are to be updated need to be specified. */
        const data = Object.keys(context.messages.in.content).reduce((acc, key) => {
            if (
                !ignoredDataProperties.includes(key)
                && !ignoredDataPropertiesPrefixes.some(prefix => key.startsWith(prefix))
            ) {
                // All this will be passed as data to ZOHO.

                // Handle the arrays
                if (complexDataProperties.includes(key)) {
                    let array = context.messages.in.content[key]?.AND || [];
                    // Handle the custom_fields array. Only non-null values are passed.
                    if (key === 'contact_persons') {
                        array = array.filter(cf => cf.index !== null);
                    }
                    acc[key] = array;
                } else {
                    // All other values are passed as is.
                    acc[key] = context.messages.in.content[key];
                }
            } else {
                // Special parsing for billing and shipping address.
                if (key.startsWith('billing_address')) {
                    acc['billing_address'] = acc['billing_address'] || {};
                    const billingAddressKey = key.replace('billing_address_', '');
                    acc['billing_address'][billingAddressKey] = context.messages.in.content[key];
                } else if (key.startsWith('shipping_address')) {
                    acc['shipping_address'] = acc['shipping_address'] || {};
                    const shippingAddressKey = key.replace('shipping_address_', '');
                    acc['shipping_address'][shippingAddressKey] = context.messages.in.content[key];
                } else if (key.startsWith('default_templates')) {
                    // Special parsing for default_templates.
                    acc['default_templates'] = acc['default_templates'] || {};
                    const defaultTemplatesKey = key.replace('default_templates_', '');
                    acc['default_templates'][defaultTemplatesKey] = context.messages.in.content[key];
                }
            }
            return acc;
        }, {});

        if (Object.keys(data).length === 0) {
            // This will result in ZOHO response: { code: 11, message: 'The parameter JSONString is mandatory.' }
            throw new context.CancelError('No data to create contact with.');
        }

        const zc = new ZohoClient(context);
        const organization_id = context.messages.in.content.organization_id;
        const { contact } = await zc.request('POST', '/books/v3/contacts', { data, params: { organization_id } });

        return context.sendJson(contact, 'out');
    }
};
