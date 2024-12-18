'use strict';

const { baseUrl, getAuthHeader } = require('./lib');

module.exports = (context, options) => {

    const BlockIPRuleModel = require('./BlockIPRuleModel')(context);

    const MAX_IPS_PER_RULE = parseInt(context.config.blockIpMaxIpsPerRule, 10) || 20;
    /** Max POST, PUT and DELETE requests to Imperva API at the same time. */
    const MAX_PARALLEL_REQUESTS = parseInt(context.config.blockIpMaxParallelRequests, 10) || 5;
    /**
     * Max number of custom rules in Imperva.
     * @see https://docs.imperva.com/bundle/cloud-application-security/page/rules/create-rule.htm
    */
    const MAX_RULES_IN_IMPERVA = parseInt(context.config.blockIpMaxRulesInImperva, 10) || 500;

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
                    context.log('info', `[IMPERVA] Extended ${extended.modifiedCount} existing block IP records.`, { extended: existingBlockIPRules });
                }
                const extendedIPs = existingBlockIPRules.map(rule => rule.ip);
                // Find the new blocked IPs, ie. the ones that are not already blocked.
                const ipsToBeBlocked = ips.filter(ip => !existingBlockIPRules.find(rule => rule.ip === ip));

                // Now we have a list of IPs that need to fit into the existing rules.
                // Or create new rules if there they don't fit.
                const rulesToUpdate = {}; // Indicates which rules need to be updated by adding new IPs.
                /** Successfully saved to Imperva */
                const processedRuleIPPairs = [];

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

                    // Ensure that we can create the rules.
                    const ensureResult = await ensureIPsCanBeAdded(context, siteId, auth, {
                        extendableRules: existingRules,
                        newIPs: ipsToBeBlocked
                    });
                    if (ensureResult?.error) {
                        return ensureResult;
                    }

                    // Make API calls to update the rules.
                    // Process `MAX_PARRALEL_REQUESTS` rule chunks in parallel
                    const promisesUpdate = Object.keys(rulesToUpdate).map(ruleId => {
                        // eslint-disable-next-line max-len
                        return updateRule(auth, siteId, ruleId, ruleName, rulesToUpdate[ruleId], processedRuleIPPairs, ips);
                    });
                    // Batches of promises to be processed in parallel by MAX_PARRALEL_REQUESTS.
                    const parallelChunks = [];
                    for (let i = 0; i < promisesUpdate.length; i += MAX_PARALLEL_REQUESTS) {
                        const chunk = promisesUpdate.slice(i, i + MAX_PARALLEL_REQUESTS);
                        parallelChunks.push(chunk);
                    }

                    for (const chunk of parallelChunks) {
                        const results = await Promise.allSettled(chunk);

                        // Error occured. Save the successful rules to the database to be in sync with Imperva.
                        if (isError(results)) {
                            return handleImpervaError(results, processedRuleIPPairs, siteId, removeAfter, auth);
                        }
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

                        // Process `MAX_PARRALEL_REQUESTS` rule chunks in parallel
                        const parallelChunks = [];
                        for (let i = 0; i < ruleIPChunks.length; i += MAX_PARALLEL_REQUESTS) {
                            const chunk = ruleIPChunks.slice(i, i + MAX_PARALLEL_REQUESTS);
                            parallelChunks.push(chunk);
                        }

                        for (const chunk of parallelChunks) {
                            const promises = chunk.map((ruleIps, i) => {
                                const totalOrder = (i + 1) + (parallelChunks.indexOf(chunk) * MAX_PARALLEL_REQUESTS);
                                return createRule(auth, siteId, ruleIps, ruleName, totalOrder, processedRuleIPPairs);
                            });
                            const results = await Promise.allSettled(promises);

                            // Error occured. Save the successful rules to the database to be in sync with Imperva.
                            if (isError(results)) {
                                return handleImpervaError(results, processedRuleIPPairs, siteId, removeAfter, auth);
                            }
                        }
                    }

                    // All the POST API calls to Imperva are done. Now we can save the new rules to the database.
                    // Create an array of BlockIPRuleModel records. One for each IP.
                    const blockedIPsRecords = getModelRecords(processedRuleIPPairs, siteId, removeAfter, auth);
                    // Don't insert the IPs that were already blocked by updating the existing records in the database.
                    const recordsToInsert = blockedIPsRecords.filter(record => !extendedIPs.includes(record.ip));
                    if (recordsToInsert.length > 0) {
                        const inserted = await context.db.collection(BlockIPRuleModel.collection)
                            .insertMany(recordsToInsert);
                        context.log('info', `[IMPERVA] Inserted ${inserted.insertedCount} new block IP records.`, { new: recordsToInsert });
                    }
                }

                // All went well. Send the response.
                return {
                    // Both PUT and POST requests to Imperva API
                    processed: processedRuleIPPairs
                };
            }
        }
    });

    function isError(results) {

        return results.filter(result => result.status === 'rejected').length > 0;
    }

    async function handleImpervaError(results, processed, siteId, removeAfter, auth) {

        const rules = results.filter(result => result.status === 'fulfilled').map(result => result.value);
        // Some rules failed to create.
        // Save the successful rules to the database to be in sync with Imperva.
        const recordsSavedToImperva = getModelRecords(processed, siteId, removeAfter, auth);
        if (rules.length > 0) {
            const inserted = await context.db.collection(BlockIPRuleModel.collection)
                .insertMany(recordsSavedToImperva);
            context.log('trace', `Inserted ${inserted.insertedCount} new block IP records after an error occured.`, { new: recordsSavedToImperva });
        }

        const errors = results.filter(result => result.status === 'rejected');

        // Provide more information on successfuly blocked IPs - which rule they were added to.
        return {
            error: errors.map(error => error.reason).join(', '),
            processed
        };
    }

    async function createRule(auth, siteId, ips, ruleName, order, processed = []) {

        const filter = ips.map(ip => `ClientIP == ${ip}`).join(' & ');

        const { data } = await context.httpRequest({
            headers: getAuthHeader(auth),
            url: `${baseUrl}/v2/sites/${siteId}/rules`,
            method: 'POST',
            data: {
                name: ruleName + ' ' + order,
                filter,
                action: 'RULE_ACTION_BLOCK'
            }
        });

        processed.push(...ips.map(ip => ({ ruleId: data.rule_id, ip })));

        const rule = { ...data, siteId, batch: order };

        return rule;
    }

    async function updateRule(auth, siteId, ruleId, ruleName, ips, processed = [], allNewIPs) {

        const filter = ips.map(ip => `ClientIP == ${ip}`).join(' & ');

        const { data } = await context.httpRequest({
            headers: getAuthHeader(auth),
            url: `${baseUrl}/v2/sites/${siteId}/rules/${ruleId}`,
            method: 'PUT',
            data: {
                name: ruleName,
                filter,
                action: 'RULE_ACTION_BLOCK'
            }
        });

        // Add the IPs to the processed list. Only the ones that were actually added to the rule.
        processed.push(...ips.filter(ip => allNewIPs.includes(ip)).map(ip => ({ ruleId, ip })));

        const rule = { ...data, siteId };

        return rule;
    }

    // IPs can be added in two ways:
    // 1. Add to an existing rule if it is not full - 20 IPs per rule
    // 2. Create a new rule if the existing rules are full - 20 IPs per rule
    async function ensureIPsCanBeAdded(context, siteId, auth, { extendableRules = {}, newIPs = [] }) {

        // Number of IPs that can be added to the existing rules.
        const numOfIPsThatCanBeAdded = Object.values(extendableRules)
            .reduce((acc, ips) => acc + (MAX_IPS_PER_RULE - ips.length), 0);
        // Number of new rules needed to add all the IPs that can not be added to the existing rules.
        const numOfNewRulesNeeded = Math.ceil((newIPs.length - numOfIPsThatCanBeAdded) / MAX_IPS_PER_RULE);
        if (numOfNewRulesNeeded > MAX_RULES_IN_IMPERVA) {
            // Max number of rules in Imperva is 500. We don't have to check the existing rules.
            return { error: 'Max number of rules exceeded.' };
        }

        // Get the page of 10 rules starting from (500 - numOfRulesNeeded)
        const page = Math.floor((MAX_RULES_IN_IMPERVA - numOfNewRulesNeeded) / 10);
        const url = `${baseUrl}/v1/sites/incapRules/list?site_id=${siteId}&page_num=${page}&page_size=10`;
        const { data } = await context.httpRequest({
            method: 'POST',
            headers: getAuthHeader(auth),
            url
        });

        const count = data?.incap_rules?.All?.length || 0;
        const numberOfRules = (page * 10) + count;

        if (count > 0) {
            // This means that there are rules on the last possible space for the new rules.
            return {
                error: 'New rules can not be created. Max number of rules will be exceeded.',
                message: `There is more than ${numberOfRules} rules in the site. To create ${numOfNewRulesNeeded} rules, you need to delete some rules first.`,
                numberOfRules,
                maxRules: 500
            };
        }
    }
};

function getModelRecords(simplifiedRecords = [], siteId, removeAfter, auth = {}) {
    return simplifiedRecords.map(({ ruleId, ip }) => ({
        ruleId: parseInt(ruleId, 10),
        siteId,
        removeAfter,
        auth,
        ip
    }));
}
