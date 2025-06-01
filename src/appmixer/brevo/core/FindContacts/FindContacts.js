
const lib = require('../../lib.generated');
const schema = { 'id': { 'type': 'number', 'title': 'Id' }, 'emailBlacklisted': { 'type': 'boolean', 'title': 'Email Blacklisted' }, 'smsBlacklisted': { 'type': 'boolean', 'title': 'Sms Blacklisted' }, 'createdAt': { 'type': 'string', 'title': 'Created At' }, 'modifiedAt': { 'type': 'string', 'title': 'Modified At' }, 'email': { 'type': 'string', 'title': 'Email' }, 'listIds': { 'type': 'array', 'items': { 'type': 'number' }, 'title': 'List Ids' }, 'listUnsubscribed': { 'type': 'null', 'title': 'List Unsubscribed' }, 'attributes': { 'type': 'object', 'properties': {}, 'title': 'Attributes' } };

module.exports = {
    async receive(context) {
        const { modifiedSince, createdSince, sort, segmentId, listIds, filter, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Contacts', value: 'contacts' });
        }

        const queryParams = {
            limit: 1000, modifiedSince, createdSince, sort, segmentId, listIds, filter
        };

        let allContacts = [];
        let offset = 0;
        let count = 0;
        do {
            // https://developers.brevo.com/reference/getcontacts-1
            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://api.brevo.com/v3/contacts',
                headers: {
                    'api-key': `${context.auth.apiKey}`
                },
                params: { ...queryParams, offset }
            });

            if (offset === 0) {
                count = data.count;
            }

            allContacts = allContacts.concat(data.contacts);

            offset += allContacts.length;

        } while (count > allContacts.length);

        return lib.sendArrayOutput({ context, records: allContacts, outputType, arrayPropertyValue: 'contacts' });
    }
};
