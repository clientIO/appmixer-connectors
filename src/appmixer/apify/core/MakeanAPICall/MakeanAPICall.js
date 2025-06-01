
const lib = require('../../lib.generated');
module.exports = {
    async receive(context) {
        const { path, method, body, queryParams } = context.messages.in.content;

        // https://docs.apify.com/api/v2#tag/General/operation/makeApiCall
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.apify.com/v2/{+path}',
            headers: {
                'Authorization': `Bearer ${context.auth.apiToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
