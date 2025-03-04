'use strict';

const lib = require('../lib');

let attempts = 0;
const getStatus = async function(context, { account, id }) {

    // https://developers.cloudflare.com/api/operations/lists-get-bulk-operation-status
    const { data } = await lib.callEndpoint(context, {
        action: `/accounts/${account}/rules/lists/bulk_operations/${id}`
    });

    context.log({ step: 'getting status', data });
    if (data?.result?.status === 'failed') {
        throw new context.CancelError(data?.result?.error || data?.errors);
    }

    if (data?.result?.status !== 'completed') {
        attempts++;
        if (attempts <= 5) {
            await new Promise(r => setTimeout(r, 2000));
            return await getStatus(context, { account, id });
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
        const { account, list, ips, ttl } = context.messages.in.content;

        if (accountsFetch || listFetch) {
            return await lib.fetchInputs(context, { account, listFetch, accountsFetch });
        }

        const ipsList = ips.AND;

        if (ipsList.length > 10) {
            throw new context.CancelError('Maximum IPs count is 10.');
        }

        // https://developers.cloudflare.com/api/operations/lists-create-list-items
        const { data } = await lib.callEndpoint(context, {
            method: 'POST',
            action: `/accounts/${account}/rules/lists/${list}/items`,
            data: ipsList
        });

        const status = await getStatus(context, { id: data.result.operation_id, account });

        if (status.error) {
            throw new context.CancelError(status.error);
        }

        if (ttl) {
            const removeAfter = new Date().getTime() + ttl * 1000;
            const { items: listItemsWithIds } = await lib.findIdsForIPs({ context, ips: ipsList, account, list });

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
