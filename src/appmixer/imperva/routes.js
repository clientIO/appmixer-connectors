'use strict';

const { baseUrl } = require('./lib');

module.exports = (context, options) => {

    const BlockIPRuleModel = require('./BlockIPRuleModel')(context);

    const MAX_IPS_PER_RULE = parseInt(context.config.blockIpMaxIpsPerRule, 10) || 20;
    /** Max POST, PUT and DELETE requests to Imperva API at the same time. */
    const MAX_PARRALEL_REQUESTS = parseInt(context.config.blockIpMaxParallelRequests, 10) || 5;

    const ruleName = 'Custom IP Block Rule ' + new Date().getTime();

    // Called by SetBlockIPRule component.
    context.http.router.register({
        method: 'POST',
        path: '/rules-block-ips',
        options: {
            handler: async req => {

                const { ips = [], siteId, removeAfter, auth } = req.payload;

                // Check our current blocked IPs to see if we are trying to block an IP that is already blocked.
                const existingBlockIPRules = await context.db.collection(BlockIPRuleModel.collection)
                    .find({ ip: { $in: ips }, siteId })
                    .toArray();
                if (existingBlockIPRules.length > 0) {
                    // Change the removeAfter date to the new date.
                    const extended = await context.db.collection(BlockIPRuleModel.collection)
                        .updateMany({ ip: { $in: ips }, siteId }, { $set: { removeAfter } });
                    context.log('trace', `Extended ${extended.modifiedCount} existing block IP records.`, { extended: existingBlockIPRules });
                }

                // Find the new blocked IPs, ie. the ones that are not already blocked.
                const ipsToBeBlocked = ips.filter(ip => !existingBlockIPRules.find(rule => rule.ip === ip));

                // Now we have a list of IPs that need to fit into the existing rules.
                // Or create new rules if there they don't fit.
                const rulesToUpdate = {};
                const rulesToAdd = {};

                if (ipsToBeBlocked.length > 0) {
                    // Find the rules that can be extended from the database.
                    const records = await context.db.collection(BlockIPRuleModel.collection)
                        .find({ siteId })
                        .toArray();
                    // Group them by the ruleId. Exclude the ones that exceed the limit of MAX_IPS_PER_RULE.
                    const existingRules = {};
                    records.forEach(rule => {
                        if (existingRules[rule.ruleId]) {
                            existingRules[rule.ruleId].push(rule.ip);
                        } else {
                            existingRules[rule.ruleId] = [rule.ip];
                        }
                    });
                    // Find the rules that can be extended, ie. they have less than 20 IPs in their filter.
                    const existingRulesExtendable = Object.keys(existingRules)
                        .filter(key => existingRules[key].length < MAX_IPS_PER_RULE);
                    // Try to fit as much as possible from the new IPs into the existing rules.
                    for (const ruleId of existingRulesExtendable) {
                        if (ipsToBeBlocked.length === 0) {
                            break;
                        }
                        const rule = existingRules[ruleId];
                        const remaining = MAX_IPS_PER_RULE - rule.length;
                        const toAdd = ipsToBeBlocked.splice(0, remaining);
                        if (toAdd.length > 0) {
                            rulesToUpdate[ruleId] = rule.concat(toAdd);
                        }
                    }
                    // Create an array of BlockIPRuleModel records. One for each IP.
                    const blockedIPsRecords = Object.keys(rulesToUpdate).map(ruleId => rulesToUpdate[ruleId]
                        .filter(ip => ips.includes(ip)) // Only the IPs that are in the request.
                        .map(ip => ({
                            siteId,
                            ruleId,
                            removeAfter,
                            auth,
                            ip
                        })).flat()).flat();

                    // Make API calls to update the rules.
                    // Process `MAX_PARRALEL_REQUESTS` rule chunks in parallel
                    let rulesUpdated = [];
                    const promisesUpdate = Object.keys(rulesToUpdate).map(ruleId => {
                        // eslint-disable-next-line max-len
                        return updateRule(context, auth, siteId, ruleId, ruleName, rulesToUpdate[ruleId], rulesToUpdate);
                    });
                    // Batches of promises to be processed in parallel by MAX_PARRALEL_REQUESTS.
                    const parallelChunks = [];
                    for (let i = 0; i < promisesUpdate.length; i += MAX_PARRALEL_REQUESTS) {
                        const chunk = promisesUpdate.slice(i, i + MAX_PARRALEL_REQUESTS);
                        parallelChunks.push(chunk);
                    }

                    for (const chunk of parallelChunks) {
                        const results = await Promise.all(chunk);
                        rulesUpdated = rulesUpdated.concat(results);
                    }
                    // Save the updated rules to the database.
                    if (blockedIPsRecords.length > 0) {
                        const updated = await context.db.collection(BlockIPRuleModel.collection)
                            .insertMany(blockedIPsRecords);
                        context.log('trace', `Added ${updated.insertedCount} new block IPs records to existing rules.`, { added: blockedIPsRecords });
                    }

                    // Create new rules for the remaining IPs.
                    if (ipsToBeBlocked.length > 0) {
                        // The goal is to send max 50 POST requests to Imperva API. 1 request takes 1-2 seconds.
                        // So we need to split the IPs into chunks. Max 20 IPs per rule.
                        /** Chunks of 20 IPs */
                        const ruleIPChunks = [];
                        for (let i = 0; i < ipsToBeBlocked.length; i += MAX_IPS_PER_RULE) {
                            const chunk = ipsToBeBlocked.slice(i, i + MAX_IPS_PER_RULE);
                            ruleIPChunks.push(chunk);
                        }

                        let rulesCreated = [];
                        // Process `MAX_PARRALEL_REQUESTS` rule chunks in parallel
                        const parallelChunks = [];
                        for (let i = 0; i < ruleIPChunks.length; i += MAX_PARRALEL_REQUESTS) {
                            const chunk = ruleIPChunks.slice(i, i + MAX_PARRALEL_REQUESTS);
                            parallelChunks.push(chunk);
                        }

                        for (const chunk of parallelChunks) {
                            const promises = chunk.map((ruleIps, i) => {
                                const totalOrder = (i + 1) + (parallelChunks.indexOf(chunk) * MAX_PARRALEL_REQUESTS);
                                return createRule(context, auth, siteId, ruleIps, ruleName, totalOrder, rulesToAdd);
                            });
                            try {
                                const results = await Promise.all(promises);
                                rulesCreated = rulesCreated.concat(results);
                            } catch (e) {
                                if (e.response?.status >= 400) {
                                    // For example: "exceeded amount of allowed rules per site" when creating more than 500 rules.
                                    // Send the successfully created rules to the output.
                                    context.sendJson({ siteId, rules: rulesCreated, ips: ipsValid }, 'out');

                                    // Then throw the error and don't retry.
                                    throw new context.CancelError('Error creating rules: ', e.response.data);
                                }
                                throw e;
                            }
                        }

                        // All the POST API calls to Imperva are done. Now we can save the new rules to the database.
                        // Create an array of BlockIPRuleModel records. One for each IP.
                        const blockedIPsRecords = ipsToBeBlocked.map(ip => ({
                            siteId,
                            ruleId: Object.keys(rulesToAdd).find(key => rulesToAdd[key].includes(ip)),
                            removeAfter,
                            auth,
                            ip
                        }));

                        if (blockedIPsRecords.length > 0) {
                            const inserted = await context.db.collection(BlockIPRuleModel.collection)
                                .insertMany(blockedIPsRecords);
                            context.log('trace', `Inserted ${inserted.insertedCount} new block IP records.`, { new: blockedIPsRecords });
                        }
                    }
                }

                return blockIPRules;
            }
        }
    });
};

async function createRule(context, auth, siteId, ips, ruleName, order, processed = {}) {

    const filter = ips.map(ip => `ClientIP == ${ip}`).join(' & ');

    const { data } = await context.httpRequest({
        headers: {
            'x-API-Id': auth.id,
            'x-API-Key': auth.key
        },
        url: `${baseUrl}/v2/sites/${siteId}/rules`,
        method: 'POST',
        data: {
            name: ruleName + ' ' + order,
            filter,
            action: 'RULE_ACTION_BLOCK'
        }
    });

    processed[data.rule_id] = ips;

    const rule = { ...data, siteId, batch: order };

    return rule;
}

async function updateRule(context, auth, siteId, ruleId, ruleName, ips, processed = {}) {

    const filter = ips.map(ip => `ClientIP == ${ip}`).join(' & ');

    const { data } = await context.httpRequest({
        headers: {
            'x-API-Id': auth.id,
            'x-API-Key': auth.key
        },
        url: `${baseUrl}/v2/sites/${siteId}/rules/${ruleId}`,
        method: 'PUT',
        data: {
            name: ruleName,
            filter,
            action: 'RULE_ACTION_BLOCK'
        }
    });

    processed[data.rule_id].updated = true;

    const rule = { ...data, siteId };

    return rule;
}
