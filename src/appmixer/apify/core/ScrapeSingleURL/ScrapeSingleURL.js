
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { url } = context.messages.in.content;

        // https://docs.apify.com/api/v2#/reference/actor-tasks/scrape-single-url/scrape-single-url
        const { data } = await context.httpRequest({
            method: 'POST',
            url: 'https://api.apify.com/v2/actor-tasks/scrape-single-url/runs',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
