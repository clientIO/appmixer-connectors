
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { resourceName } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/people/deleteContact
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: 'https://people.googleapis.com/v1/{resourceName}:deleteContact',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
