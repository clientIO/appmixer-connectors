const ZoneCloudflareClient = require('../../ZoneCloudflareClient');

let attempts = 0;
const getStatus = async function(context, client, { account, id }) {

    context.log({ stage: 'GETTING STATUS', id, attempts });
    // https://developers.cloudflare.com/api/operations/lists-get-bulk-operation-status
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

                return context.sendJson(items, 'out');
            }

            if (listFetch) {
                const { data } = await client.callEndpoint(context, { action: `/accounts/${account}/rules/lists` });
                const items = data.result.map(item => {
                    return {
                        label: item.name,
                        value: item.id
                    };
                });
                return context.sendJson(items, 'out');
            }

        } catch (e) {
            return context.sendJson([], 'out');
        }

        const ipsList = ips.AND;

        // https://developers.cloudflare.com/api/operations/lists-create-list-items
        const { data } = await client.callEndpoint(context, {
            method: 'POST',
            action: `/accounts/${account}/rules/lists/${list}/items`,
            data: ipsList
        });

        const status = await getStatus(context, client, { id: data.result.operation_id, account });

        if (status.error) {
            throw new context.CancelError(status.error);
        }

        return context.sendJson({
            ...status,
            ips: ipsList.map(item => item.ip).join(',')
        }, 'out');
    }
};
