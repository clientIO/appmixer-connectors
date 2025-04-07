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
        if (attempts <= 10) {
            await new Promise(r => setTimeout(r, 1000));
            return await getStatus(context, { account, id });
        } else {
            throw new context.CancelError(data.errors);
        }
    }

    return data.result;
};

module.exports = {
    async receive(context) {

        const { account, list, ips } = context.messages.in.content;

        const ipsList = lib.parseIPs(ips);

        const { items: listItemsWithIds, notFound } = await lib.findIdsForIPs({ context, ips: ipsList, account, list });

        if (!listItemsWithIds.length) {
            return context.sendJson({
                id: null,
                status: 'Completed',
                completed: new Date().toISOString(),
                deleted: [],
                notFound: ipsList
            }, 'out');
        }
        context.log({ step: 'removing IPs ', items: listItemsWithIds });

        // https://developers.cloudflare.com/api/operations/lists-create-list-items
        const { data } = await lib.callEndpoint(context, {
            method: 'DELETE',
            action: `/accounts/${account}/rules/lists/${list}/items`,
            data: { items: listItemsWithIds.map(item => ({ id: item.id })) }
        });

        const status = await getStatus(context, { id: data.result.operation_id, account });

        if (status.error) {
            throw new context.CancelError(status.error);
        }

        return context.sendJson({ ...status, notFound, deleted: listItemsWithIds.map(item => item.ip) }, 'out');
    }
};
