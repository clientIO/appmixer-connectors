
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { readMask } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/otherContacts/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://people.googleapis.com/v1/otherContacts',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
