const CloudflareListClient = require('./lists/CloudflareListClient');

const deleteExpireIpsFromList = async function(context) {

    const expired = await getExpiredItems(context);

    const groups = Object.values(expired);

    const promises = groups.map(chunk => {

        const { email, apiKey, account, list } = chunk.auth;

        context.log('info', { stage: '[CloudFlare] removing ', ips: chunk.ips, list, account });

        const client = new CloudflareListClient({ email, apiKey });
        // https://developers.cloudflare.com/api/operations/lists-delete-list-items
        return client.callEndpoint(context, {
            method: 'DELETE', action: `/accounts/${account}/rules/lists/${list}/items`, data: { items: chunk.ips }
        });
    });

    const itemsToDelete = { ids: [], lists: [] };

    (await Promise.allSettled(promises)).forEach(async (result, i) => {
        if (result.status === 'fulfilled') {
            itemsToDelete.ids = itemsToDelete.ids.concat(groups[i].ips);
            itemsToDelete.lists.push(groups[i]?.auth?.list);
        } else {
            const operations = groups[i].ips.map(item => ({
                updateOne: {
                    filter: { id: item.id }, update: { $set: { mtime: new Date } }
                }
            }));
            await (context.db.collection(IPListModel.collection)).bulkWrite(operations);
        }
    });

    if (itemsToDelete.ids.length) {
        const deleted = await context.db.collection(IPListModel.collection)
            .deleteMany({ id: { $in: itemsToDelete.ids.map(item => item.id) } });
        await context.log('info', {
            stage: `[CloudFlare] Deleted total ${deleted.deletedCount} ips.`,
            lists: itemsToDelete.lists,
            itemIds: itemsToDelete.ids
        });
    }
};

const getExpiredItems = async function(context) {

    const expired = await context.db.collection(IPListModel.collection)
        .find({ removeAfter: { $lt: Date.now() } })
        .toArray();

    return expired.reduce((res, item) => {
        const key = item.auth.list; // listId
        res[key] = res[key] || { ips: [] };
        res[key].auth = item.auth;
        res[key].ips.push({ id: item.id });

        return res;
    }, {});
};

module.exports = {
    deleteExpireIpsFromList
};
