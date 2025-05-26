
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { contactPerson } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/people/createContact
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://people.googleapis.com/v1/people:createContact',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
