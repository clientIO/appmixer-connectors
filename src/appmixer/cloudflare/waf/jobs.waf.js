const CloudflareWAFClient = require('./CloudflareWAFClient');
const lib = require('./lib');

const deleteExpireIps = async function(context) {

    const expired = await getExpiredItems(context);

    await context.log('info', { type: '[CloudFlareWAF] expired.', expired });

    const groups = Object.values(expired);
    const getRulePromises = groups.map(item => {
        const client = new CloudflareWAFClient({ token: item.auth.token, zoneId: item.zoneId });
        return client.getRules(context, item.rulesetId);
    });

    const rulesToUpdate = [];
    (await Promise.allSettled(getRulePromises)).forEach((result, i) => {

        if (result.status === 'fulfilled') {
            const item = groups[i];

            const { result: { rules = [] } } = result.value;
            const rule = rules.find(r => r.id === item.ruleId);
            if (rule) {
                rulesToUpdate.push({
                    ...item, rule: lib.removeIpsFromRule(rule, item?.ips?.map(i => i.ip))
                });
            }
        }
    });

    await context.log('info', { type: '[CloudFlareWAF] to update.', rulesToUpdate });
    const updatePromises = rulesToUpdate.map(rulesToUpdate => {

        const { zoneId, rulesetId, auth, rule } = rulesToUpdate;
        const client = new CloudflareWAFClient({ token: auth.token, zoneId });

        return client.updateBlockRule(context, rulesetId, rule);
    });

    try {

        let dbItemsToDelete = [];
        (await Promise.allSettled(updatePromises)).forEach(async (result, i) => {

            const item = rulesToUpdate[i];
            const dbItems = item?.ips?.map(i => i.id) || [];
            context.log('info', { type: '[CloudFlareWAF] db item', item, s: result.status, dbItems });

            if (result.status === 'fulfilled') {
                dbItemsToDelete = dbItemsToDelete.concat(dbItems);
            } else {
                context.log('info', { type: '[CloudFlareWAF] db item delet 111' });
                const model = require('../RulesIPsModel')(context);
                context.log('info', { type: '[CloudFlareWAF] db item delet 222' });

                const operations = dbItems.map(item => ({
                    updateOne: {
                        filter: { id: item.id }, update: { $set: { mtime: new Date } }
                    }
                }));
                context.log('info', { type: '[CloudFlareWAF] db item ops', operations });

                await (context.db.collection(model.collection)).bulkWrite(operations);

                context.log('info', { type: '[CloudFlareWAF] AAA' });

                // context.log('error', { type: '[CloudFlareWAF] Update rule failed', data: { ...item.rule } });
            }
        });

        await deleteDBItems(context, dbItemsToDelete);
    } catch (e) {
        context.log('error', { type: '[CloudFlareWAF] Unexpected error', data: e?.message || e });
    }
};

const deleteDBItems = async function(context, ids = []) {

    context.log('info', { type: '[CloudFlareWAF] db items to delete', data: ids });

    const model = require('../RulesIPsModel')(context);
    if (ids.length) {

        const deleted = await context.db.collection(model.collection)
            .deleteMany({ id: { $in: ids } });

        await context.log('info', `[CloudFlare] Deleted ${deleted.deletedCount} ips.`);
    }
};

const getExpiredItems = async function(context) {

    const model = require('../RulesIPsModel')(context);

    const expired = await context.db.collection(model.collection)
        .find({ removeAfter: { $lt: Date.now() } })
        .toArray();

    return expired.reduce((res, item) => {
        const key = item.ruleId;
        res[key] = res[key] || { ips: [] };
        res[key].ips.push({ ip: item.ip, id: item.id });
        res[key].auth = item.auth;
        res[key].id = item.id;
        res[key].zoneId = item.zoneId;
        res[key].ruleId = item.ruleId;
        res[key].rulesetId = item.rulesetId;

        return res;
    }, {});
};

module.exports = {
    deleteExpireIps
};
