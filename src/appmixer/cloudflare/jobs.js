const listsJobs = require('./jobs.lists');

module.exports = async (context) => {

    const IPListModel = require('./IPListModel')(context);

    const config = require('./config')(context);

    await context.scheduleJob('cloudflare-lists-ips-delete-job', config.ipDeleteJob.schedule, async () => {

        try {
            const lock = await context.job.lock('cloudflare-lists-rule-block-ips-delete-job', { ttl: config.ipDeleteJob.lockTTL });
            await context.log('trace', '[Cloudflare Lists] rule delete job started.');

            try {
                await listsJobs.deleteExpiredIpsFromList(context);
            } finally {
                lock.unlock();
                await context.log('trace', '[Cloudflare Lists] rule delete job finished. Lock unlocked.');
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', {
                    step: '[Cloudflare Lists] Error checking rules to delete',
                    error: err,
                    errorRaw: context.utils.Error.stringify(err)
                });
            }
        }
    });

    // Self-healing job to remove rules that have created>mtime. These rules are stuck in the system and should be removed.
    await context.scheduleJob('cloudflare-lists-ips-cleanup-job', config.cleanup.schedule, async () => {

        let lock = null;
        try {
            lock = await context.job.lock('cloudflare-lists-ips-cleanup-job', { ttl: config.cleanup.lockTTL });
            await context.log('trace', '[Cloudflare  Lists] IPs cleanup job started.');

            // Delete IPs where the time difference between 'mtime' and 'removeAfter' exceeds the specified timespan,
            // indicating that deletion attempts have persisted for the entire timespan.
            const timespan = 30 * 60 * 1000; // 30 min
            const expired = await context.db.collection(IPListModel.collection).deleteMany({
                $expr: { $gt: [{ $subtract: ['$mtime', '$removeAfter'] }, timespan] }
            });

            if (expired.deletedCount) {
                await context.log('info', { step: `[Cloudflare Lists] Deleted ${expired.deletedCount} orphaned rules.` });
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', {
                    step: '[Cloudflare Lists]  Error checking orphaned ips',
                    error: err,
                    errorRaw: context.utils.Error.stringify(err)
                });
            }
        } finally {
            lock?.unlock();
            await context.log('trace', '[Cloudflare Lists] IPs cleanup job finished. Lock unlocked.');
        }
    });
};
