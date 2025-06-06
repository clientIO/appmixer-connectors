
module.exports = {
    async receive(context) {
        const { contactGroupId, addContacts, removeContacts } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://people.googleapis.com/v1/contactGroups/${contactGroupId}/members:modify`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data: {
                resourceNamesToAdd: addContacts?.split(',').map(contactId => 'people/' + contactId),
                resourceNamesToRemove: removeContacts?.split(',').map(contactId => 'people/' + contactId)
            }
        });

        return context.sendJson(data, 'out');
    }
};
