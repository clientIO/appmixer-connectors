
const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Folders', value: 'result' });
        }

        const queryParams = {
            limit: 1000
        };

        let allFolders = [];
        let offset = 0;
        let count = 0;
        do {
            // https://developers.brevo.com/docs/getting-started#find-folders
            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://api.brevo.com/v3/contacts/folders',
                headers: {
                    'api-key': `${context.auth.apiKey}`
                },
                params: { ...queryParams, offset }
            });

            if (offset === 0) {
                count = data.count;
            }

            allFolders = allFolders.concat(data.folders);

            offset += allFolders.length;

        } while (count > allFolders.length);

        return lib.sendArrayOutput({ context, records: allFolders, outputType });
    }
};

const schema = {
    'id': { 'type': 'number', 'title': 'Folder ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'uniqueSubscribers': { 'type': 'number', 'title': 'Unique Subscribers' },
    'totalSubscribers': { 'type': 'number', 'title': 'Total Subscribers' },
    'totalBlacklisted': { 'type': 'number', 'title': 'Total Blacklisted' }
};
