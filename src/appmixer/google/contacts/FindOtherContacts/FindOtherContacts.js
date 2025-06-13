const lib = require('../lib.generated');
const { personSchema } = require('./../schemas');

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, personSchema, { label: 'Other Contacts', value: 'result' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/otherContacts',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                readMask: 'emailAddresses,metadata,names,phoneNumbers,photos'
            }
        });

        const records = data.otherContacts.map((contact) => {
            return {
                id: contact.resourceName.split('/')[1],
                etag: contact.etag,
                updateTime: contact.metadata.sources[0].updateTime,
                displayName: contact.names[0].displayName,
                givenName: contact.names[0].givenName,
                displayNameLastFirst: contact.names[0].displayNameLastFirst,
                unstructuredName: contact.names[0].unstructuredName,
                photoUrl: contact.photos[0].url,
                memberships: contact.memberships
            };
        });

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
