
const lib = require('../lib.generated');
module.exports = {
    async receive(context) {
        const { personFields } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/people/searchContacts
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://people.googleapis.com/v1/people:searchContacts?personFields=${personFields}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
