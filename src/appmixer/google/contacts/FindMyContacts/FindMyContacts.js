const lib = require('../lib.generated');
const schema = { 'resourceName': { 'type': 'string', 'title': 'Resource Name' }, 'names': { 'type': 'array', 'items': { 'type': 'object', 'properties': { 'displayName': { 'type': 'string', 'title': 'Names.Display Name' } } }, 'title': 'Names' } };

module.exports = {
    async receive(context) {
        const { sortOrder, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'connections', value: 'connections' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/people/me/connections',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                sortOrder,
                personFields: 'addresses,ageRanges,biographies,birthdays,calendarUrls,clientData,coverPhotos,emailAddresses,events,externalIds,genders,imClients,interests,locales,locations,memberships,metadata,miscKeywords,names,nicknames,occupations,organizations,phoneNumbers,photos,relations,sipAddresses,skills,urls,userDefined,fileAses'
            }
        });

        return lib.sendArrayOutput({ context, records: data.connections, outputType, arrayPropertyValue: 'connections' });
    }
};
