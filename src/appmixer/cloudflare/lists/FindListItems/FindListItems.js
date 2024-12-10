const ZoneCloudflareClient = require('../../ZoneCloudflareClient');

module.exports = {
    async receive(context) {

        const { apiKey, email } = context.auth;
        const { account, list, term } = context.messages.in.content;
        const client = new ZoneCloudflareClient({ email, apiKey });

        const { data } = await client.callEndpoint(context, {
            method: 'GET',
            action: `/accounts/${account}/rules/lists/${list}/items`,
            params: {
                per_page: 1,
                search: term
            }
        });

        return context.sendJson(data.result[0], 'out');
    }
};
