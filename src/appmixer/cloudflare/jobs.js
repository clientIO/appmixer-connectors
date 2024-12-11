const ZoneCloudflareClient = require('./ZoneCloudflareClient');

module.exports = async (context) => {

    const IPListModel = require('./IPListModel')(context);

    const config = require('./config')(context);

    await context.scheduleJob('cloud-flare-lists-ips-delete-job', config.ipDeleteJob.schedule, async () => {

        try {
            const lock = await context.job.lock('cloud-flare-lists-rule-block-ips-delete-job', { ttl: config.ipDeleteJob.lockTTL });
            await context.log('trace', '[CloudFlare] rule delete job started.');

            try {
                await deleteExpireIps(context);
            } finally {
                lock.unlock();
                await context.log('trace', '[CloudFlare] rule delete job finished. Lock unlocked.');
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', {
                    stage: '[CloudFlare] Error checking rules to delete',
                    error: err,
                    errorRaw: context.utils.Error.stringify(err)
                });
            }
        }
    });

    const deleteExpireIps = async function(context) {

        const expired = await getExpiredItems(context);

        const groups = Object.values(expired);

        const promises = groups.map(chunk => {

            const { email, apiKey, account, list } = chunk.auth;

            context.log('info', { stage: '[CloudFlare] removing ', ips: chunk.ips, list, account });

            const client = new ZoneCloudflareClient({ email, apiKey });
            // https://developers.cloudflare.com/api/operations/lists-delete-list-items
            return client.callEndpoint(context, {
                method: 'DELETE',
                action: `/accounts/${account}/rules/lists/${list}/items`,
                data: { items: chunk.ips }
            });
        });

        let itemsToDelete = [];
        (await Promise.allSettled(promises)).forEach(async (result, i) => {
            if (result.status === 'fulfilled') {
                itemsToDelete = itemsToDelete.concat(groups[i].ips);
            } else {
                // context.log('error', { stage: 'operations', operations });
                // context.log('error', { stage: 'XX delete ips error response',g: groups[i], result, raw: context.utils.Error.stringify(result) });
                const operations = groups[i].ips.map(item => ({
                    updateOne: {
                        filter: { id: item.id }, update: { $set: { mtime: new Date } }
                    }
                }));
                // context.log('error', { stage: 'operations', g: groups[i].ips });

                await (context.db.collection(IPListModel.collection)).bulkWrite(operations);
            }
        });

        if (itemsToDelete.length) {
            const deleted = await context.db.collection(IPListModel.collection)
                .deleteMany({ id: { $in: itemsToDelete.map(item => item.id) } });
            await context.log('info', `[CloudFlare] Deleted ${deleted.deletedCount} ips.`);
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

    // Self-healing job to remove rules that have created>mtime. These rules are stuck in the system and should be removed.
    await context.scheduleJob('cloud-flare-lists-ips-cleanup-job', config.cleanup.schedule, async () => {

        let lock = null;
        try {
            lock = await context.job.lock('cloud-flare-lists-ips-cleanup-job', { ttl: config.cleanup.lockTTL });
            await context.log('trace', '[CloudFlare] IPs cleanup job started.');

            // Delete IPs where the time difference between 'mtime' and 'removeAfter' exceeds the specified timespan,
            // indicating that deletion attempts have persisted for the entire timespan.
            const timespan = 30 * 60 * 1000; // 30 min
            const expired = await context.db.collection(IPListModel.collection).deleteMany({
                $expr: { $gt: [{ $subtract: ['$mtime', '$removeAfter'] }, timespan] }
            });

            await context.log('info', { stage: `[CloudFlare] Deleted ${expired.deletedCount} orphaned rules.` });
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', {
                    stage: '[CloudFlare]  Error checking orphaned ips',
                    error: err,
                    errorRaw: context.utils.Error.stringify(err)
                });
            }
        } finally {
            lock?.unlock();
            await context.log('trace', '[CloudFlare] IPs cleanup job finished. Lock unlocked.');
        }
    });
};
