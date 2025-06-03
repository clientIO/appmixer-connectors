const lib = require('../lib.generated');
const schema = { 'resourceName': { 'type': 'string', 'title': 'Resource Name' }, 'names': { 'type': 'array', 'items': { 'type': 'object', 'properties': { 'displayName': { 'type': 'string', 'title': 'Names.Display Name' } } }, 'title': 'Names' } };

module.exports = {
    async receive(context) {
        const { readMask, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'otherContacts', value: 'otherContacts' });
        }

        // https://developers.google.com/people/api/rest/v1/otherContacts/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/otherContacts',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'otherContacts' });
    }
};
