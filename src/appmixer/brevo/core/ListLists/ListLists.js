const lib = require('../../lib.generated');

'use-strict';

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Lists', value: 'result' });
        }

        const queryParams = {
            limit: 50
        };

        let allLists = [];
        let offset = 0;
        let count = 0;
        do {
            // https://developers.brevo.com/reference/getlists-1
            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://api.brevo.com/v3/contacts/lists',
                headers: {
                    'api-key': `${context.auth.apiKey}`
                },
                params: { ...queryParams, offset }
            });

            if (offset === 0) {
                count = data.count;
            }

            allLists = allLists.concat(data.lists);

            offset += data.lists.length;

        } while (count > allLists.length);

        return lib.sendArrayOutput({ context, records: allLists, outputType });
    },

    toSelectArray({ result }) {

        return result.map(list => {
            return { label: list.name, value: list.id };
        });
    }
};

const schema = {
    'id': { 'type': 'number', 'title': 'List ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'folderId': { 'type': 'number', 'title': 'Folder ID' },
    'uniqueSubscribers': { 'type': 'number', 'title': 'Unique Subscribers' },
    'totalSubscribers': { 'type': 'number', 'title': 'Total Subscribers' },
    'totalBlacklisted': { 'type': 'number', 'title': 'Total Blacklisted' }
};
