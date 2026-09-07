'use strict';
const commons = require('../../lib');

// Schema of a single customer item — powers the dynamic output-port options and
// the variable-picker preview.
const schema = {
    'id': { 'type': 'integer', 'title': 'ID', 'example': 1073339471 },
    'email': { 'type': 'string', 'title': 'Email', 'example': 'jane.doe@example.com' },
    'first_name': { 'type': 'string', 'title': 'First Name', 'example': 'Jane' },
    'last_name': { 'type': 'string', 'title': 'Last Name', 'example': 'Doe' },
    'phone': { 'type': 'string', 'title': 'Phone', 'example': '+15550101234' },
    'state': { 'type': 'string', 'title': 'State', 'example': 'enabled' },
    'note': { 'type': 'string', 'title': 'Note', 'example': 'Loyal customer' },
    'tags': { 'type': 'string', 'title': 'Tags', 'example': 'vip, wholesale' },
    'currency': { 'type': 'string', 'title': 'Currency', 'example': 'USD' },
    'orders_count': { 'type': 'integer', 'title': 'Orders Count', 'example': 3 },
    'total_spent': { 'type': 'string', 'title': 'Total Spent', 'example': '199.98' },
    'last_order_id': { 'type': 'integer', 'title': 'Last Order ID', 'example': 450789469 },
    'last_order_name': { 'type': 'string', 'title': 'Last Order Name', 'example': '#1001' },
    'accepts_marketing': { 'type': 'boolean', 'title': 'Accepts Marketing', 'example': true },
    'accepts_marketing_updated_at': { 'type': 'string', 'format': 'date-time', 'title': 'Accepts Marketing Date', 'example': '2025-01-15T10:30:00-05:00' },
    'marketing_opt_in_level': { 'type': 'string', 'title': 'Marketing Opt-in Level', 'example': 'single_opt_in' },
    'multipass_identifier': { 'type': 'string', 'title': 'Multipass Identifier', 'example': '' },
    'tax_exempt': { 'type': 'boolean', 'title': 'Tax Exempt', 'example': false },
    'verified_email': { 'type': 'boolean', 'title': 'Email Verified', 'example': true },
    'addresses': { 'type': 'array', 'title': 'Addresses', 'items': { 'type': 'object' }, 'example': [] },
    'default_address': { 'type': 'object', 'title': 'Default Address', 'example': { 'id': 207119551, 'city': 'Ottawa', 'country': 'Canada' } },
    'created_at': { 'type': 'string', 'format': 'date-time', 'title': 'Date Created', 'example': '2025-01-15T10:30:00-05:00' },
    'updated_at': { 'type': 'string', 'format': 'date-time', 'title': 'Date Updated', 'example': '2025-02-20T08:15:00-05:00' }
};

/**
 * Find customers.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { query, maxResults, sort, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return commons.getOutputPortOptions(context, outputType, schema, { label: 'Customers', value: 'result' });
        }

        if (!query) {
            throw new context.CancelError('Query is required!');
        }

        const shopify = commons.getShopifyAPI(context);
        const customers = await shopify.customer.search({
            query,
            limit: maxResults,
            order: sort
        });

        if (!customers || customers.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return commons.sendArrayOutput({ context, outputType, records: customers });
    }
};
