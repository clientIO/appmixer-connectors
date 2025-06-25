
module.exports = {
    async receive(context) {
        const { contactId } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://people.googleapis.com/v1/people/${contactId}/:deleteContact`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
