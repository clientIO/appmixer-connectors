'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const lib = require('../../lib');
const { trimUndefined } = require('../../helpers');

// Schema of a single contact item.
const schema = {
    'id': { 'type': 'string', 'title': 'Contact ID', 'example': '1001' },
    'email': { 'type': 'string', 'title': 'Email', 'example': 'jane.doe@example.com' },
    'firstName': { 'type': 'string', 'title': 'First Name', 'example': 'Jane' },
    'lastName': { 'type': 'string', 'title': 'Last Name', 'example': 'Doe' },
    'phone': { 'type': 'string', 'title': 'Phone', 'example': '+1 555 010 1234' },
    'orgid': { 'type': 'string', 'title': 'Organization ID', 'example': '12' },
    'cdate': { 'type': 'string', 'format': 'date-time', 'title': 'Created Date', 'example': '2025-01-15T10:30:00-06:00' },
    'udate': { 'type': 'string', 'format': 'date-time', 'title': 'Updated Date', 'example': '2025-02-20T08:15:00-06:00' }
};

module.exports = {

    async receive(context) {

        const { search, email, status, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Contacts', value: 'result' });
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const params = trimUndefined({
            limit: ActiveCampaign.MAX_RECORDS_PER_PAGE,
            search: search || undefined,
            email: email || undefined,
            status: status && status !== '-1' ? status : undefined
        });

        const contacts = await ac.getContacts(params, ActiveCampaign.MAX_RECORDS_PER_PAGE);

        if (contacts.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records: contacts });
    }
};
