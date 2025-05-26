
const lib = require('../../../googleContacts/lib.generated');
module.exports = {
    async receive(context) {
        const { query, readMask } = context.messages.in.content;

        // https://developers.google.com/people/api/rest/v1/directoryPeople/searchDirectoryPeople
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://people.googleapis.com/v1/directoryPeople:searchDirectoryPeople',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
