
const lib = require('../../lib.generated');
const schema = { 'id': { 'type': 'number', 'title': 'Id' }, 'name': { 'type': 'string', 'title': 'Name' } };

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Folders', value: 'result' });
        }

        // https://developers.brevo.com/docs/getting-started#find-folders
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.brevo.com/v3/contacts/folders',
            headers: {
                'api-key': `${context.auth.apiKey}`
            }
        });

        return lib.sendArrayOutput({ context, records: data.folders, outputType });
    }
};
