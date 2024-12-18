const { baseUrl, getAuthHeader } = require('./lib');

module.exports = async (context) => {

    const config = require('./config')(context);
    const BlockIPRuleModel = require('./BlockIPRuleModel')(context);
    const COLLECTION_NAME_BLOCK_IPS = BlockIPRuleModel.collection;
    /** Max POST, PUT and DELETE requests to Imperva API at the same time. */
    const MAX_PARRALEL_REQUESTS = parseInt(context.config.blockIpMaxParallelRequests, 10) || 10;

    await context.scheduleJob('imperva-rule-block-ips-delete-job', config.ruleDeleteJob.schedule, async () => {

        try {
            const lock = await context.job.lock('imperva-rule-block-ips-delete-job', { ttl: config.ruleDeleteJob.lockTTL });
            await context.log('trace', '[imperva-rule-block-ips-delete-job] rule delete job started.');

            try {
                // Important assumptions:
                // - IPs in a single Imperva rule can expire at different times.
                // - Only this connector should manipulate the rules.

                // Find all the IPs that have expired.
                const expiredIPs = await context.db.collection(COLLECTION_NAME_BLOCK_IPS)
                    // If ttl was not set, removeAfter is null
                    .find({ removeAfter: { $lt: Date.now() } })
                    .toArray();
                if (expiredIPs.length) {
                    await context.log('info', `[imperva-rule-block-ips-delete-job] Found ${expiredIPs.length} expired IPs. Processing...`);
                }

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
                 *       { ruleId2, auth, method: 'DELETE', ipsToUnblock: [ip5] }
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
                    const rules = rulesBySite[siteId];

                    const chunks = [];

                    for (let i = 0; i < rules.length; i += MAX_PARRALEL_REQUESTS) {
                        chunks.push(rules.slice(i, i + MAX_PARRALEL_REQUESTS));
                    }

                    let chunkIndex = 0;
                    for (const chunk of chunks) {
                        chunkIndex++;
                        // Creating an array of promises here so only these are fired together.
                        const chunkPromises = chunk.map(rule => {
                            if (rule.method === 'DELETE') {
                                const params = {
                                    headers: getAuthHeader(rule.auth),
                                    url: `${baseUrl}/v2/sites/${siteId}/rules/${rule.ruleId}`,
                                    method: 'DELETE'
                                };
                                return context.httpRequest(params);
                            } else {
                                const filter = rule.ipsToKeepBlocking.map(ip => `ClientIP == ${ip}`).join(' & ');
                                const params = {
                                    headers: getAuthHeader(rule.auth),
                                    url: `${baseUrl}/v2/sites/${siteId}/rules/${rule.ruleId}`,
                                    method: 'PUT',
                                    data: {
                                        name: ruleName,
                                        filter,
                                        action: 'RULE_ACTION_BLOCK'
                                    }
                                };
                                return context.httpRequest(params);
                            }
                        });
                        const all = await Promise.allSettled(chunkPromises);

                        all.forEach((result, i) => {
                            if (result.status === 'fulfilled') {
                                siteIPsToDelete.push(chunk[i].ipsToUnblock);
                                const action = result.value?.data?.filter ? 'updated' : 'deleted';
                                const details = { action };
                                if (action === 'updated') {
                                    details.filter = result.value.data.filter;
                                }
                                context.log('info', `[imperva-rule-block-ips-delete-job] [${chunkIndex}] Processed rule ${chunk[i].ruleId} for site ${siteId} via Imperva API.`, details);
                            } else {
                                if (result.reason.response?.status === 404) {
                                    // Rule not found, probably already deleted
                                    siteIPsToDelete.push(chunk[i].ipsToUnblock);
                                    context.log('info', `[imperva-rule-block-ips-delete-job] [${chunkIndex}] Rule ${chunk[i].ruleId} not found in Imperva for site ${siteId}. Probably already deleted.`);
                                } else {
                                    context.log('error', `[imperva-rule-block-ips-delete-job] [${chunkIndex}] Error deleting rule ${chunk[i].ruleId}`, context.utils.Error.stringify(result.reason));
                                    // Modify the mtime for either all the IPs in the rule or just the IPs that failed to delete
                                    context.db.collection(COLLECTION_NAME_BLOCK_IPS).updateMany(
                                        {
                                            ruleId: chunk[i].ruleId,
                                            siteId,
                                            ip: { $in: chunk[i].ipsToUnblock }
                                        },
                                        { $set: { mtime: Date.now() } }
                                    );
                                }
                            }
                        });

                        // Only after successful deletion, delete the rules from the database
                        const allIPsToDelete = siteIPsToDelete.flat();
                        const del = { siteId: parseInt(siteId, 10), ip: { $in: allIPsToDelete } };
                        const deleted = await context.db.collection(COLLECTION_NAME_BLOCK_IPS).deleteMany(del);

                        if (deleted.deletedCount) {
                            await context.log('info', `[imperva-rule-block-ips-delete-job] [${chunkIndex}] Deleted ${deleted.deletedCount} IP records for site ${siteId} from the DB.`, { deletedIPs: allIPsToDelete });
                        }

                        // Extend the lock for the next chunk
                        if (chunks.length > 1) {
                            await lock.extend(config.ruleDeleteJob.lockTTL);
                            await context.log('info', `[imperva-rule-block-ips-delete-job] [${chunkIndex}] Lock extended.`);
                        }
                    }
                }
            } finally {
                lock.unlock();
                await context.log('trace', '[imperva-rule-block-ips-delete-job] rule delete job finished. Lock unlocked.');
            }
        } catch (err) {
            if (err.message !== 'locked') {
                context.log('error', '[imperva-rule-block-ips-delete-job] Error checking rules to delete', context.utils.Error.stringify(err));
            }
        }
    });
};
