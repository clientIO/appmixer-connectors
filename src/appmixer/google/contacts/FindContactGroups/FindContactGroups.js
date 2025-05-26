
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { pageToken } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/contactGroups/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/contactGroups',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
