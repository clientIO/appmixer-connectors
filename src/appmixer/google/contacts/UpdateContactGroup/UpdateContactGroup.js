
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { resourceName, contactGroup } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/contactGroups/update
        const { data } = await context.httpRequest({
            method: 'PUT',
            url: 'https://people.googleapis.com/v1/{resourceName}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
