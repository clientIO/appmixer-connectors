const { baseUrl } = require('./lib');

module.exports = async (context) => {

    const BlockIPRuleModel = require('./BlockIPRuleModel')(context);
    const COLLECTION_NAME_BLOCK_IPS = BlockIPRuleModel.collection;
    const config = require('./config')(context);

    await context.scheduleJob('imperva-rule-block-ips-delete-job', config.ruleDeleteJob.schedule, async () => {

        try {
            const lock = await context.job.lock('imperva-rule-block-ips-delete-job', { ttl: config.ruleDeleteJob.lockTTL });
            await context.log('trace', '[IMPERVA] rule delete job started.');

            try {
                // Important assumptions:
                // - IPs in a single rule are meant to expire at the same time.
                // - The same IP can be in multiple rules.

                // Possible improvements to fit the largest possible number of IPs into the limit of max 500 custom rules:
                // - Allways create rules with the maximum number of IPs.
                // - Track the expiration of IPs in the database and update the rule filters when IPs expire.

                // Find all rules that should be deleted. Limit to batchSize.
                const expiredRules = await context.db.collection(COLLECTION_NAME_BLOCK_IPS)
                    .find({ removeAfter: { $lt: Date.now() } })
                    .limit(config.ruleDeleteJob.batchSize)
                    .toArray();
                await context.log('trace', `[IMPERVA] Deleting ${expiredRules.length} IPs.`, { expiredRules });

                // Split them into chunks of 10. This will fire 10 requests in parallel and wait for all of them to finish.
                const chunkSize = 10;
                const chunks = [];
                for (let i = 0; i < expiredRules.length; i += chunkSize) {
                    chunks.push(expiredRules.slice(i, i + chunkSize));
                }
                // Call Imperva API to delete all rules in a chunk
                for (const chunk of chunks) {
                    await context.log('info', `[IMPERVA] Deleting chunk number ${chunks.indexOf(chunk) + 1} of ${chunks.length}.`);
                    const ruleIdsToDelete = [];
                    const promises = chunk.map(rule => {
                        context.log('info', `[IMPERVA] Deleting rule ${rule.ruleId}.`, { rule });
                        return context.httpRequest({
                            headers: {
                                'x-API-Id': rule.auth.id,
                                'x-API-Key': rule.auth.key
                            },
                            url: `${baseUrl}/v2/sites/${rule.siteId}/rules/${rule.ruleId}`,
                            method: 'DELETE'
                        });
                    });
                    const all = await Promise.allSettled(promises);
                    all.forEach((result, i) => {
                        if (result.status === 'fulfilled') {
                            ruleIdsToDelete.push(chunk[i].ruleId);
                        } else {
                            if (result.reason.response?.status === 404) {
                                // Rule not found, probably already deleted
                                ruleIdsToDelete.push(chunk[i].ruleId);
                                context.log('info', `[IMPERVA] Rule ${chunk[i].ruleId} not found. Probably already deleted.`);
                            } else {
                                context.log('error', `[IMPERVA] Error deleting rule ${chunk[i].ruleId}`, context.utils.Error.stringify(result.reason));
                                // Modify the mtime
                                context.db.collection(COLLECTION_NAME_BLOCK_IPS)
                                    .updateOne({ ruleId: chunk[i].ruleId }, { $set: { mtime: new Date } });
                            }
                        }
                    });
                    // Only after successful deletion, delete the rules from the database
                    const deleted = await context.db.collection(COLLECTION_NAME_BLOCK_IPS)
                        .deleteMany({ ruleId: { $in: ruleIdsToDelete } });
                    await context.log('info', `[IMPERVA] Deleted ${deleted.deletedCount} rules.`);

                    // Extend the lock for the next chunk
                    if (chunks.length > 1) {
                        await lock.extend(config.ruleDeleteJob.lockTTL);
                        await context.log('trace', '[IMPERVA] Lock extended.');
                    }
                }
            } finally {
                lock.unlock();
                await context.log('trace', '[IMPERVA] rule delete job finished. Lock unlocked.');
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', '[IMPERVA] Error checking rules to delete', context.utils.Error.stringify(err));
            }
        }
    });
};
