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
                // - IPs in a single Imperva rule can expire at different times.
                // - Only this connector should manipulate the rules.

                // Find all the IPs that have expired.
                const expiredIPs = await context.db.collection(COLLECTION_NAME_BLOCK_IPS)
                    // If ttl was not set, removeAfter is null
                    .find({ removeAfter: { $lt: Date.now() } })
                    .toArray();
                await context.log('trace', `[IMPERVA] Found ${expiredIPs.length} expired IPs.`, { expiredIPs });

                // For the expired IPs we need to also load all the other IPs in the same rule.
                // This is because we need to delete the entire rule if all the IPs in it have expired.
                // Or just update the rule if some IPs are still valid.
                const ruleIds = expiredIPs.map(ip => ip.ruleId);
                const allIPs = await context.db.collection(COLLECTION_NAME_BLOCK_IPS)
                    .find({ ruleId: { $in: ruleIds } })
                    .toArray();

                // Group the IPs by ruleId
                const ruleIPs = {};
                allIPs.forEach(ip => {
                    if (!ruleIPs[ip.ruleId]) {
                        ruleIPs[ip.ruleId] = [];
                    }
                    ruleIPs[ip.ruleId].push(ip);
                });

                // Check if all the IPs in a rule have expired
                const rulesToDelete = [];
                for (const ruleId in ruleIPs) {
                    const rule = ruleIPs[ruleId];
                    const expired = rule.every(ip => expiredIPs.find(e => e.ruleId === ip.ruleId));
                    if (expired) {
                        rulesToDelete.push(ruleId);
                    }
                }

                /* Construct object of rules to delete/update grouped by siteId.
                 * {
                 *   siteId1: [
                 *       { ruleId1, auth, method: 'PUT', ipsToUnblock: [ip1, ip3], ipsToKeepBlocking: [ip2] },
                 *       { ruleId2, auth, method: 'DELETE' }
                 *  ],
                 *  siteId2: [
                 *       { ruleId3, auth, method: 'DELETE' }
                 *  ]
                 * }
                 **/
                const rulesBySite = {};
                for (const ipRecord of expiredIPs) {
                    if (!rulesBySite[ipRecord.siteId]) {
                        rulesBySite[ipRecord.siteId] = [];
                    }

                    let rule = rulesBySite[ipRecord.siteId].find(r => r.ruleId === ipRecord.ruleId);
                    if (rule) {
                        if (!rule.ipsToUnblock) {
                            rule.ipsToUnblock = [];
                        }
                        rule.ipsToUnblock.push(ipRecord.ip);
                    } else {
                        const newRule = {
                            ruleId: ipRecord.ruleId,
                            auth: ipRecord.auth,
                            method: 'PUT',
                            ipsToUnblock: [ipRecord.ip]
                        };
                        rulesBySite[ipRecord.siteId].push(newRule);
                        rule = newRule;
                    }
                    const allRuleIPs = allIPs
                        .filter(ip => ip.ruleId === ipRecord.ruleId && ip.siteId === ipRecord.siteId);
                    rule.ipsToKeepBlocking = allRuleIPs.map(ip => ip.ip).filter(ip => !rule.ipsToUnblock.includes(ip));
                    // If all the IPs in the rule have expired, delete the rule
                    if (rule.ipsToUnblock.length === allRuleIPs.length) {
                        rule.method = 'DELETE';
                    }
                }

                // Process the rules by site
                for (const siteId in rulesBySite) {
                    const ruleName = 'Custom IP Block Rule ' + new Date().getTime();
                    const siteIPsToDelete = []; // From MongoDB
                    const siteRuleIDsToDelete = []; // From MongoDB
                    const rules = rulesBySite[siteId];
                    const promises = rules.map(rule => {
                        if (rule.method === 'DELETE') {
                            return context.httpRequest({
                                headers: {
                                    'x-API-Id': rule.auth.id,
                                    'x-API-Key': rule.auth.key
                                },
                                url: `${baseUrl}/v2/sites/${siteId}/rules/${rule.ruleId}`,
                                method: 'DELETE'
                            });
                        } else {
                            const filter = rule.ipsToKeepBlocking.map(ip => `ClientIP == ${ip}`).join(' & ');

                            return context.httpRequest({
                                headers: {
                                    'x-API-Id': rule.auth.id,
                                    'x-API-Key': rule.auth.key
                                },
                                url: `${baseUrl}/v2/sites/${siteId}/rules/${rule.ruleId}`,
                                method: 'PUT',
                                data: {
                                    name: ruleName,
                                    filter,
                                    action: 'RULE_ACTION_BLOCK'
                                }
                            });
                        }
                    });

                    // Split them into chunks of 10. This will fire 10 requests in parallel and wait for all of them to finish.
                    const chunkSize = 10;
                    const chunks = [];

                    for (let i = 0; i < rules.length; i += chunkSize) {
                        chunks.push(rules.slice(i, i + chunkSize));
                    }

                    for (const chunk of chunks) {
                        const all = await Promise.allSettled(chunk.map((rule, i) => promises[i]));
                        all.forEach((result, i) => {
                            if (result.status === 'fulfilled') {
                                if (chunk[i].method === 'DELETE') {
                                    siteRuleIDsToDelete.push(chunk[i].ruleId);
                                } else {
                                    siteIPsToDelete.push(chunk[i].ipsToUnblock);
                                }
                            } else {
                                if (result.reason.response?.status === 404) {
                                    // Rule not found, probably already deleted
                                    siteIPsToDelete.push(chunk[i].ruleId);
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
                            .deleteMany({
                                siteId,
                                $or: [
                                    { ruleId: { $in: siteRuleIDsToDelete } },
                                    { ip: { $in: siteIPsToDelete.flat() } }
                                ]
                            });

                        await context.log('info', `[IMPERVA] Deleted ${deleted.deletedCount} records for site ${siteId}.`);

                        // Extend the lock for the next chunk
                        if (chunks.length > 1) {
                            await lock.extend(config.ruleDeleteJob.lockTTL);
                            await context.log('trace', '[IMPERVA] Lock extended.');
                        }
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
