module.exports = {
    async receive(context) {
        const { resourceName, maxMembers } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/contactGroups/get
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/{resourceName}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
