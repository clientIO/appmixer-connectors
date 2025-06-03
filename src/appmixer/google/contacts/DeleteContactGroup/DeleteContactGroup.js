
module.exports = {
    async receive(context) {
        const { resourceName } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/contactGroups/delete
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://people.googleapis.com/v1/{resourceName}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
