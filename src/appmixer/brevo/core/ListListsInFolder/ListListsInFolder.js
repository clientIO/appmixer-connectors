'use strict';

const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { folderId, outputType, sort } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Lists', value: 'result' });
        }

        const queryParams = {
            limit: 50, sort
        };

        let allLists = [];
        let offset = 0;
        let count = 0;
        do {
            // https://developers.brevo.com/reference/getfolderlists-1
            const { data } = await context.httpRequest({
                method: 'GET',
                url: `https://api.brevo.com/v3/contacts/folders/${folderId}/lists`,
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

            allLists = allLists.concat(data.lists);

            offset += data.lists.length;

        } while (count > allLists.length);

        return lib.sendArrayOutput({ context, records: allLists, outputType });
    }
};

const schema = {
    'id': { 'type': 'number', 'title': 'List ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'uniqueSubscribers': { 'type': 'number', 'title': 'Unique Subscribers' },
    'totalSubscribers': { 'type': 'number', 'title': 'Total Subscribers' },
    'totalBlacklisted': { 'type': 'number', 'title': 'Total Blacklisted' }
};
