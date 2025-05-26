
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { personFields } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/people.connections/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/people/me/connections',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
