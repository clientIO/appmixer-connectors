
module.exports = {
    async receive(context) {
        const { groupId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://people.googleapis.com/v1/contactGroups/${groupId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
