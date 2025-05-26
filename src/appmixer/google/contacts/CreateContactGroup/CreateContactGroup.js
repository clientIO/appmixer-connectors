
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { contactGroup } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/contactGroups/create
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://people.googleapis.com/v1/contactGroups',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
