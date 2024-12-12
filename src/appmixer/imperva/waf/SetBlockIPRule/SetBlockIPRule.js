'use strict';

const { Address4, Address6 } = require('ip-address');
const { baseUrl } = require('../../lib');

const ACTION = 'RULE_ACTION_BLOCK';

module.exports = {

    receive: async function(context) {

        const MAX_IPS_PER_RULE = parseInt(context.config.blockIpMaxIpsPerRule, 10) || 20;
        const MAX_IPS_ALLOWED = parseInt(context.config.blockIpMaxIpsAllowed, 10) || 1000;
        /** Max POST requests to Imperva API at the same time. */
        const MAX_PARRALEL_REQUESTS = parseInt(context.config.blockIpMaxParallelRequests, 10) || 5;

        const { siteId, ips, ttl } = context.messages.in.content;

        const ruleName = 'Custom IP Block Rule ' + new Date().getTime();
        const ipsValid = [];
        const ipsInvalid = [];
        const allIps = ips.split(/\s+|,/); // Split by comma or any whitespace
        for (const ip of allIps) {
            if (Address4.isValid(ip) || Address6.isValid(ip)) {
                ipsValid.push(ip);
            } else {
                ipsInvalid.push(ip);
            }
        }

        if (ipsInvalid.length) {
            throw new context.CancelError('Found invalid IPs: ' + ipsInvalid.join(', '));
        }
        if (ipsValid.length > MAX_IPS_ALLOWED) {
            throw new context.CancelError(`Too many IPs provided. Max ${MAX_IPS_ALLOWED}. You provided ${ipsValid.length}.`);
        }

        // The goal is to send max 50 POST requests to Imperva API. 1 request takes 1-2 seconds.
        // So we need to split the IPs into chunks. Max 20 IPs per rule.
        /** Chunks of 20 IPs */
        const ruleIPChunks = [];
        for (let i = 0; i < ipsValid.length; i += MAX_IPS_PER_RULE) {
            const chunk = ipsValid.slice(i, i + MAX_IPS_PER_RULE);
            ruleIPChunks.push(chunk);
        }

        // Check if we can create the rules
        await this.ensureCustomRulesCanBeCreated(context, siteId, ruleIPChunks.length);

        let rules = [];
        // Process `MAX_PARRALEL_REQUESTS` rule chunks in parallel
        const parallelChunks = [];
        for (let i = 0; i < ruleIPChunks.length; i += MAX_PARRALEL_REQUESTS) {
            const chunk = ruleIPChunks.slice(i, i + MAX_PARRALEL_REQUESTS);
            parallelChunks.push(chunk);
        }

        for (const chunk of parallelChunks) {
            const promises = chunk.map((ruleIps, i) => {
                const totalOrder = (i + 1) + (parallelChunks.indexOf(chunk) * MAX_PARRALEL_REQUESTS);
                return this.createRule(context, siteId, ruleIps, ruleName, ttl, totalOrder);
            });
            try {
                const results = await Promise.all(promises);
                rules = rules.concat(results);
            } catch (e) {
                if (e.response?.status >= 400) {
                    // For example: "exceeded amount of allowed rules per site" when creating more than 500 rules.
                    // Send the successfully created rules to the output.
                    context.sendJson({ siteId, rules, ips: ipsValid }, 'out');

                    // Then throw the error and don't retry.
                    throw new context.CancelError('Error creating rules: ', e.response.data);
                }
                throw e;
            }
        }

        return context.sendJson({ siteId, rules, ips: ipsValid }, 'out');
    },

    createRule: async function(context, siteId, ips, ruleName, ttl, order) {

        const filter = ips.map(ip => `ClientIP == ${ip}`).join(' & ');

        const { data } = await context.httpRequest({
            headers: {
                'x-API-Id': context.auth.id,
                'x-API-Key': context.auth.key
            },
            url: `${baseUrl}/v2/sites/${siteId}/rules`,
            method: 'POST',
            data: {
                name: ruleName + ' ' + order,
                filter,
                action: ACTION
            }
        });

        const rule = { ...data, siteId, batch: order };

        // If ttl is not set, the rule will be active indefinitely.
        const removeAfter = ttl ? (new Date().getTime() + ttl * 1000) : null;
        await context.callAppmixer({
            endPoint: '/plugins/appmixer/imperva/rules-block-ips',
            method: 'POST',
            body: {
                ruleId: rule.rule_id,
                siteId,
                removeAfter,
                ips,
                auth: {
                    id: context.auth.id,
                    key: context.auth.key
                }
            }
        });

        return rule;
    },

    ensureCustomRulesCanBeCreated: async function(context, siteId, numOfRulesNeeded) {

        if (numOfRulesNeeded > 500) {
            throw new context.CancelError('Max number of rules exceeded');
        }

        // Get the page of 10 rules starting from (500 - numOfRulesNeeded)
        const page = Math.floor((500 - numOfRulesNeeded) / 10);
        const url = `${baseUrl}/v1/sites/incapRules/list?site_id=${siteId}&page_num=${page}&page_size=10`;
        const { data } = await context.httpRequest({
            method:'POST',
            headers: {
                'x-API-Id': context.auth.id,
                'x-API-Key': context.auth.key
            },
            url
        });

        const count = data?.incap_rules?.All?.length || 0;

        if (count > 0) {
            // This means that there are rules on the last possible space for the new rules.
            throw new context.CancelError('New rules can not be created. Max number of rules will be exceeded.', {
                message: `There is more than ${(page * 10) + count} rules in the site. To create ${numOfRulesNeeded} rules, you need to delete some rules first.`,
                maxRules: 500
            });
        }
    }
};
