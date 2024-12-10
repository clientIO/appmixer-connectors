const ZoneCloudflareClient = require('../../ZoneCloudflareClient');
const lib = require('../lib');

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

const getIds = async function({ context, client, ips = [], account, list, removeAfter }) {

    const result = [];
    for (let ip of ips) {

        const { data } = await client.callEndpoint(context, {
            method: 'GET',
            action: `/accounts/${account}/rules/lists/${list}/items`,
            params: {
                per_page: 1,
                search: ip
            }
        });

        if (data?.result[0]) {
            result.push({
                ...data.result[0]
            });
        }
    }

    return result;
};

module.exports = {
    async receive(context) {

        const { apiKey, email } = context.auth;
        const { accountsFetch, listFetch } = context.properties;
        const { account, list, ips, ttl } = context.messages.in.content;

        const client = new ZoneCloudflareClient({ email, apiKey });

        if (accountsFetch || listFetch) {
            return await lib.fetchInputs(context, client, { account, listFetch, accountsFetch });
        }

        const ipsList = ips.AND;

        if (ipsList.length > 10) {
            throw new context.CancelError('Maximum IPs count it 10.');
        }

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

        if (ttl) {
            const removeAfter = new Date().getTime() + ttl * 1000;
            const listItemsWithIds = await getIds({ context, client, ips: ipsList, account, list });

            const dbItems = listItemsWithIds.map(item => {
                const { ip, id } = item;
                return {
                    ip, id,
                    removeAfter,
                    auth: {
                        email, apiKey, account, list
                    }
                };
            });

            await context.callAppmixer({
                endPoint: '/plugins/appmixer/cloudflare/ip-list',
                method: 'POST',
                body: {
                    items: dbItems
                }
            });
        }

        return context.sendJson({
            ...status
        }, 'out');
    }
};
