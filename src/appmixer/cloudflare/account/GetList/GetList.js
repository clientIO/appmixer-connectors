const ZoneCloudflareClient = require('../../ZoneCloudflareClient');
const { OUTPUT_PORT } = require('../../lib');

function output(context, message, output) {
    return context.sendJson({ message }, output.valueOf());
}

module.exports = {
    async receive(context) {

        const { apiKey, email } = context.auth;
        const { accountsFetch, listFetch } = context.properties;
        const { account, list } = context.messages.in.content;

        const client = new ZoneCloudflareClient({ email, apiKey });

        try {
            if (accountsFetch) {
                const { data } = await client.callEndpoint(context, { action: '/accounts?per_page=50' });
                const items = data.result.map(item => {
                    return {
                        label: item.name,
                        value: item.id
                    };
                });

                return context.sendJson(items, OUTPUT_PORT.SUCCESS);
            }

            if (listFetch) {
                const { data } = await client.callEndpoint(context, { action: `/accounts/${account}/rules/lists` });
                const items = data.result.map(item => {
                    console.log(item);
                    return {
                        label: item.name,
                        value: item.id
                    };
                });
                return context.sendJson(items, OUTPUT_PORT.SUCCESS);
            }

        } catch (e) {
            return context.sendJson([], OUTPUT_PORT.SUCCESS);
        }

        try {

            const items = [
                {
                    // asn: ,
                    ip: '192.168.1.1',
                    comment: 'sdflkdsjflk '
                    // hostname: {
                    //     url_hostname: 'lksajdklfj.com'
                    // }
                }
            ];
            // https://developers.cloudflare.com/api/operations/lists-create-list-items
            const { data } = await client.callEndpoint(context, {
                action: `/accounts/${account}/rules/lists/${list}`,
                method: 'GET',
                data: items
            });
            // const { data } = await client.callEndpoint(context, {
            //     action: `/accounts/${account}/rules/lists/${list}/items`,
            //     method: 'POST',
            //     data: items
            // });

            console.log('----------------------');
            console.log(data);
            return context.sendJson(data, OUTPUT_PORT.SUCCESS);

        } catch (err) {

            console.log(err.response.data);
            return context.sendJson({ message: 'error' }, OUTPUT_PORT.FAILURE);
        }
    }
};
