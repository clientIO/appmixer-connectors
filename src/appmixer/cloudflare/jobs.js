const listsJobs = require('./jobs.lists');

module.exports = async (context) => {

    const IPListModel = require('./IPListModel')(context);

    const config = require('./config')(context);

    await context.scheduleJob('cloud-flare-lists-ips-delete-job', config.ipDeleteJob.schedule, async () => {

        try {
            const lock = await context.job.lock('cloud-flare-lists-rule-block-ips-delete-job', { ttl: config.ipDeleteJob.lockTTL });
            await context.log('trace', '[CloudFlare] rule delete job started.');

            try {
                await listsJobs.deleteExpireIpsFromList(context);
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

            if (expired.deletedCount) {
                await context.log('info', { stage: `[CloudFlare] Deleted ${expired.deletedCount} orphaned rules.` });
            }
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
