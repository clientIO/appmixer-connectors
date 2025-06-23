'use-strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { listId, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Contacts', value: 'result' });
        }

        const queryParams = {
            limit: 500
        };

        let allLists = [];
        let offset = 0;
        let count = 0;
        do {
            // https://developers.brevo.com/reference/getcontactsfromlist
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://api.brevo.com/v3/contacts/lists/${listId}/contacts`,
                headers: {
                    'api-key': `${context.auth.apiKey}`
                },
                params: { ...queryParams, offset }
            });

            if (offset === 0) {
                count = data.count;
                if (!count) {
                    return context.sendJson({}, 'notFound');
                }
            }

            allLists = allLists.concat(data.contacts);

            offset += data.contacts.length;

        } while (count > allLists.length);

        return lib.sendArrayOutput({ context, records: allLists, outputType });
    }
};

const schema = {
    'id': { 'type': 'number', 'title': 'Contact ID' },
    'emailBlacklisted': { 'type': 'boolean', 'title': 'Email Blacklisted' },
    'smsBlacklisted': { 'type': 'boolean', 'title': 'SMS Blacklisted' },
    'createdAt': { 'type': 'string', 'title': 'Created At' },
    'modifiedAt': { 'type': 'string', 'title': 'Modified At' },
    'email': { 'type': 'string', 'title': 'Email' },
    'listIds': { 'type': 'array', 'items': { 'type': 'number' }, 'title': 'List IDs' },
    'listUnsubscribed': { 'type': 'boolean', 'title': 'List Unsubscribed' },
    'attributes': { 'type': 'object', 'properties': {}, 'title': 'Attributes' }
};
