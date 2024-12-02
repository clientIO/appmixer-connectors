const ZoneCloudflareClient = require('../../ZoneCloudflareClient');
const { OUTPUT_PORT } = require('../../lib');

let attempts = 0;
const getStatus = async function(context, client, { account, id }) {

    context.log({ stage: 'GETTING STATUS', id, attempts });
    const { data } = await client.callEndpoint(context, {
        action: `/accounts/${account}/rules/lists/bulk_operations/${id}`
    });

    context.log({ stage: 'STATUS DATA', data });
    if (data?.result?.status === 'failed') {
        throw new context.CancelError(data?.result?.error || data?.errors);
    }

    if (data?.result?.status !== 'completed') {
        attempts++;
        if (attempts <= 5) {
            await new Promise(r => setTimeout(r, 2000));
            return await getStatus(context, client, { account, id });
        } else {
            throw new context.CancelError(data.errors);
        }
    }

    return data.result;
};

module.exports = {
    async receive(context) {

        const { apiKey, email } = context.auth;
        const { accountsFetch, listFetch } = context.properties;
        const { account, list, ips } = context.messages.in.content;

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

        const ipsList = ips.AND;

        try {

            // https://developers.cloudflare.com/api/operations/lists-create-list-items
            const { data } = await client.callEndpoint(context, {
                action: `/accounts/${account}/rules/lists/${list}/items`,
                method: 'POST',
                data: ipsList
            });

            await getStatus(context, client, { id: data.result.operation_id, account });
            return context.sendJson({ message: `IPs successfully added: ${ipsList.map(item => item.ip).join(',')}` }, OUTPUT_PORT.SUCCESS);

        } catch (err) {

            context.log({ stage: 'ERROR', detail: err?.response || err });
            return context.sendJson({ message: `Adding IPs failed: ${ipsList.map(item => item.ip).join(', ')}` }, OUTPUT_PORT.FAILURE);
        }
    }
};
