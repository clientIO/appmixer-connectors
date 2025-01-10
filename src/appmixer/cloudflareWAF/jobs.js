const wafJobs = require('./jobs.waf');

module.exports = async (context) => {

    const RulesIPsModel = require('./RulesIPsModel')(context);

    const config = require('./config')(context);

    await context.scheduleJob('cloud-flare-waf-ips-delete-job', config.ipDeleteJob.schedule, async () => {

        try {
            const lock = await context.job.lock('cloud-flare-waf-rule-block-ips-delete-job', { ttl: config.ipDeleteJob.lockTTL });
            await context.log('trace', '[CloudFlare WAF] rule delete job started.');

            try {
                await wafJobs.deleteExpireIps(context);
            } finally {
                lock.unlock();
                await context.log('trace', '[CloudFlare WAF] rule delete job finished. Lock unlocked.');
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
    await context.scheduleJob('cloud-flare-waf-ips-cleanup-job', config.cleanup.schedule, async () => {

        let lock = null;
        try {
            lock = await context.job.lock('cloud-flare-waf-ips-cleanup-job', { ttl: config.cleanup.lockTTL });
            await context.log('trace', '[CloudFlare WAF] IPs cleanup job started.');

            // Delete IPs where the time difference between 'mtime' and 'removeAfter' exceeds the specified timespan,
            // indicating that deletion attempts have persisted for the entire timespan.
            const timespan = 30 * 60 * 1000; // 30 min
            await context.db.collection(RulesIPsModel.collection).deleteMany({
                $expr: { $gt: [{ $subtract: ['$mtime', '$removeAfter'] }, timespan] }
            });

            if (expired.deletedCount) {
                await context.log('info', { stage: `[CloudFlare WAF] Deleted ${expired.deletedCount} orphaned rules.` });
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', {
                    stage: '[CloudFlare WAF]  Error checking orphaned ips',
                    error: err,
                    errorRaw: context.utils.Error.stringify(err)
                });
            }
        } finally {
            lock?.unlock();
            await context.log('trace', '[CloudFlare WAF] IPs cleanup job finished. Lock unlocked.');
        }
    });
};
