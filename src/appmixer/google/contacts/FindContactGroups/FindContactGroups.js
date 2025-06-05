const lib = require('../lib.generated');
const schema = { 'resourceName': { 'type': 'string', 'title': 'Resource Name' }, 'name': { 'type': 'string', 'title': 'Name' } };

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'contactGroups', value: 'contactGroups' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/contactGroups',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        context.log({ step: 'response', data });

        return lib.sendArrayOutput({ context, records: data.contactGroups, outputType, arrayPropertyValue: 'contactGroups' });
    }
};
