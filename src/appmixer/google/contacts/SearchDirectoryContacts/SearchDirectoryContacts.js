const lib = require('../lib.generated');
const schema = { 'person': { 'type': 'object', 'properties': { 'resourceName': { 'type': 'string', 'title': 'Person.Resource Name' }, 'names': { 'type': 'array', 'items': { 'type': 'object', 'properties': { 'displayName': { 'type': 'string', 'title': 'Person.Names.Display Name' } } }, 'title': 'Person.Names' } }, 'title': 'Person' } };

module.exports = {
    async receive(context) {
        const { query, readMask, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'results', value: 'results' });
        }

        // https://developers.google.com/people/api/rest/v1/people/searchDirectoryPeople
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/people:searchDirectoryPeople',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'results' });
    }
};
