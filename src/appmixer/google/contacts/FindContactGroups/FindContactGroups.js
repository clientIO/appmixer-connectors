const lib = require('../lib.generated');
const schema = { 'resourceName': { 'type': 'string', 'title': 'Resource Name' }, 'name': { 'type': 'string', 'title': 'Name' } };

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'contactGroups', value: 'contactGroups' });
        }

        // https://developers.google.com/people/api/rest/v1/contactGroups/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/contactGroups',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return lib.sendArrayOutput({ context, records, outputType, arrayPropertyValue: 'contactGroups' });
    }
};
