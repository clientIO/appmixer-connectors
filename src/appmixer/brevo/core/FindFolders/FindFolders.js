
const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'number','title':'Id' },'name':{ 'type':'string','title':'Name' } };

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Folders', value: 'folders' });
        }

        // https://developers.brevo.com/docs/getting-started#find-folders
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.brevo.com/v3/contacts/folders',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'folders' });
    }
};
