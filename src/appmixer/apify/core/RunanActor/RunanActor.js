
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { actorId, body, startUrls, pageFunction } = context.messages.in.content;

        // https://docs.apify.com/api/v2#/reference/actors/run-actor/run-actor
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.apify.com/v2/actors/{actorId}/runs',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
