const lib = require('../lib.generated');
const schema = { 'resourceName': { 'type': 'string', 'title': 'Resource Name' }, 'names': { 'type': 'array', 'items': { 'type': 'object', 'properties': { 'displayName': { 'type': 'string', 'title': 'Names.Display Name' } } }, 'title': 'Names' } };

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'otherContacts', value: 'otherContacts' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/otherContacts',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return lib.sendArrayOutput({ context, records: data.connections, outputType, arrayPropertyValue: 'otherContacts' });
    }
};
