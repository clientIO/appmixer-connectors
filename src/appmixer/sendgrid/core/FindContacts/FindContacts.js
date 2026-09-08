'use strict';

const lib = require('../../lib');

const schema = {
    'id': { 'type': 'string', 'title': 'ID' },
    'email': { 'type': 'string', 'title': 'Email' },
    'first_name': { 'type': 'string', 'title': 'First Name' },
    'last_name': { 'type': 'string', 'title': 'Last Name' },
    'address_line_1': { 'type': 'string', 'title': 'Address Line 1' },
    'address_line_2': { 'type': 'string', 'title': 'Address Line 2' },
    'city': { 'type': 'string', 'title': 'City' },
    'state_province_region': { 'type': 'string', 'title': 'State/Province/Region' },
    'postal_code': { 'type': 'string', 'title': 'Postal Code' },
    'country': { 'type': 'string', 'title': 'Country' },
    'alternate_emails': { 'type': 'array', 'title': 'Alternate Emails' },
    'list_ids': { 'type': 'array', 'title': 'List IDs' },
    'created_at': { 'type': 'string', 'title': 'Created At' },
    'updated_at': { 'type': 'string', 'title': 'Updated At' }
};

module.exports = {

    async receive(context) {

        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            const options = lib.getOutputPortOptions(context, outputType, schema, { label: 'Contacts' });
            return context.sendJson(options, 'out');
        }

        let contacts;

        if (query && query.trim()) {
            // Use search endpoint with query
            contacts = await lib.paginatedApiRequest(context, '/marketing/contacts/search', 'result', {
                method: 'POST',
                data: { query }
            });
        } else {
            // List all contacts without query
            contacts = await lib.paginatedApiRequest(context, '/marketing/contacts', 'result');
        }

        if (!contacts || contacts.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        return lib.sendArrayOutput({
            context,
            outputType: outputType || 'array',
            records: contacts
        });
    }
};
