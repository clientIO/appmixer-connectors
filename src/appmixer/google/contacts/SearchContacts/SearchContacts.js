const lib = require('../lib.generated');
const schema = { 'person': { 'type': 'object', 'properties': { 'resourceName': { 'type': 'string', 'title': 'Person.Resource Name' }, 'names': { 'type': 'array', 'items': { 'type': 'object', 'properties': { 'displayName': { 'type': 'string', 'title': 'Person.Names.Display Name' } } }, 'title': 'Person.Names' } }, 'title': 'Person' } };

module.exports = {
    async receive(context) {
        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'results', value: 'results' });
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/people:searchContacts',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                query,
                readMask: 'addresses,ageRanges,biographies,birthdays,calendarUrls,clientData,coverPhotos,emailAddresses,events,externalIds,genders,imClients,interests,locales,locations,memberships,metadata,miscKeywords,names,nicknames,occupations,organizations,phoneNumbers,photos,relations,sipAddresses,skills,urls,userDefined,fileAses'
            }
        });

        return lib.sendArrayOutput({ context, records: data.connections, outputType, arrayPropertyValue: 'results' });
    }
};
