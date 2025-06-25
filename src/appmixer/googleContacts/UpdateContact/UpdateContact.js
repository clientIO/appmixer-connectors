module.exports = {
    async receive(context) {
        const { contactId, firstName, familyName, emails, phones, notes } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/people/get
        const { data: currentData } = await context.httpRequest({
            method: 'GET',
            url: `https://people.googleapis.com/v1/people/${contactId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                personFields: 'addresses,ageRanges,biographies,birthdays,calendarUrls,clientData,coverPhotos,emailAddresses,events,externalIds,genders,imClients,interests,locales,locations,memberships,metadata,miscKeywords,names,nicknames,occupations,organizations,phoneNumbers,photos,relations,sipAddresses,skills,urls,userDefined'
            }
        });

        const emailAddresses = emails?.ADD.map(email => ({
            value: email.value,
            displayName: email.displayName ?? undefined,
            type: email.type ?? undefined
        }));

        const phoneNumbers = phones?.ADD.map(phone => ({
            value: phone.value,
            type: phone.type ?? undefined
        }));

        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: `https://people.googleapis.com/v1/people/${contactId}/:updateContact`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                updatePersonFields: 'addresses,biographies,birthdays,clientData,emailAddresses,events,externalIds,genders,imClients,interests,locales,locations,memberships,miscKeywords,names,nicknames,occupations,organizations,phoneNumbers,relations,sipAddresses,skills,urls,userDefined'
            },
            data: {
                etag: currentData.etag,
                names: [
                    { givenName: firstName, familyName }
                ],
                biographies: [
                    { contentType: 'TEXT_PLAIN', value: notes }
                ],
                emails: emailAddresses, phoneNumbers,
                memberships: currentData.memberships
            }
        });

        const betterResponse = {
            id: data.resourceName.split('/')[1],
            etag: data.etag,
            updateTime: data.metadata.sources[0].updateTime,
            displayName: data.names[0].displayName,
            givenName: data.names[0].givenName,
            displayNameLastFirst: data.names[0].displayNameLastFirst,
            unstructuredName: data.names[0].unstructuredName,
            photoUrl: data.photos[0].url,
            memberships: data.memberships
        };

        return context.sendJson(betterResponse, 'out');
    }
};
