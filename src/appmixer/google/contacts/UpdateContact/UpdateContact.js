module.exports = {
    async receive(context) {
        const { resourceName, updatePersonFields, person } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/people/updateContact
        const { data } = await context.httpRequest({
            method: 'PATCH',
            url: 'https://people.googleapis.com/v1/{resourceName}:updateContact',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
