
const lib = require('../../lib.generated');
const schema = { 'id':{ 'type':'number','title':'Id' },'email':{ 'type':'string','title':'Email' } };

module.exports = {
    async receive(context) {
        const { listId, email, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Contacts', value: 'contacts' });
        }

        // https://developers.brevo.com/docs/getting-started#find-contacts-in-list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.brevo.com/v3/contacts/lists/{listId}/contacts',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'contacts' });
    }
};
