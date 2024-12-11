const ZoneCloudflareClient = require('./ZoneCloudflareClient');

module.exports = async (context) => {

    const IPListModel = require('./IPListModel')(context);

    const config = require('./config')(context);

    await context.scheduleJob('cloud-flare-lists-ips-delete-job', config.ruleDeleteJob.schedule, async () => {

        try {
            const lock = await context.job.lock('cloud-flare-lists-rule-block-ips-delete-job', { ttl: config.ruleDeleteJob.lockTTL });
            await context.log('trace', '[CloudFlare] rule delete job started.');

            try {
                await deleteExpireIps(context);

            } finally {
                lock.unlock();
                await context.log('trace', '[CloudFlare] rule delete job finished. Lock unlocked.');
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', { stage: '[CloudFlare] Error checking rules to delete', error: err });
            }
        }
    });

    const deleteExpireIps = async function(context) {

        const expired = await getExpiredItems(context);

        await context.log('trace', `[CloudFlare] Deleting ${expired.length} rules.`);

        const itemIDsGrouped = expired.reduce((res, item) => {
            const key = item.auth.list; // listId
            res[key] = res[key] || { ips: [] };
            res[key].auth = item.auth;
            res[key].ips.push({ id: item.id });

            return res;
        }, {});

        let itemsToDelete = [];
        const chunks = Object.values(itemIDsGrouped);

        for (let x of chunks) {

            await context.log('info', { stage: '[CloudFlare] chunk', x });

            const { email, apiKey, account, list } = x.auth;
            const client = new ZoneCloudflareClient({ email, apiKey });
            // https://developers.cloudflare.com/api/operations/lists-delete-list-items
            await client.callEndpoint(context, {
                method: 'DELETE',
                action: `/accounts/${account}/rules/lists/${list}/items`,
                data: { items: x.ips }
            });
            itemsToDelete = itemsToDelete.concat(x.ips);
        }

        await context.log('info', { stage: '[CloudFlare]ldsjflds', itemsToDelete });

        const deleted = await context.db.collection(IPListModel.collection)
            .deleteMany({ id: { $in: ruleIdsToDelete.map(item => item.id) } });
        await context.log('info', `[CloudFlare] Deleted ${deleted.deletedCount} ips.`);
    };

    const getExpiredItems = async function(context) {

        return await context.db.collection(IPListModel.collection)
            .find({ removeAfter: { $lt: Date.now() } })
            // .limit(config.ruleDeleteJob.batchSize)
            .toArray();
    };

    // Self-healing job to remove rules that have created>mtime. These rules are stuck in the system and should be removed.
    // await context.scheduleJob('cloud-flare-lists-rule-block-ips-self-healing-job', config.ruleSelfHealingJob.schedule, async () => {
    //
    //     let lock = null;
    //     try {
    //         lock = await context.job.lock('cloud-flare-lists-rule-block-ips-self-healing-job', { ttl: config.ruleSelfHealingJob.lockTTL });
    //         await context.log('trace', '[CloudFlare] rule self-healing job started.');
    //
    //         // Delete all rules that were modified more than 1 day ago and have not been deleted yet.
    //         const expiredRules = await context.db.collection(COLLECTION_IP_LIST).deleteMany({
    //             mtime: { $lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }
    //         });
    //         await context.log('info', `[CloudFlare] Deleted ${expiredRules.deletedCount} orphaned rules.`);
    //     } catch (err) {
    //         if (err.message !== 'locked') {
    //             context.log('error', '[CloudFlare] Error checking orphaned rules', context.utils.Error.stringify(err));
    //         }
    //     } finally {
    //         lock?.unlock();
    //         await context.log('trace', '[CloudFlare] rule self-healing job finished. Lock unlocked.');
    //     }
    // });
};
