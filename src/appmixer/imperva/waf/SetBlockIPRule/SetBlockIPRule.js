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
        // Split by comma or any whitespace
        const allIps = ips.split(/\s+|,/);
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

        let rules = [];
        // Process `MAX_PARRALEL_REQUESTS` rule chunks in parallel
        const parallelChunks = [];
        for (let i = 0; i < ruleIPChunks.length; i += MAX_PARRALEL_REQUESTS) {
            const chunk = ruleIPChunks.slice(i, i + MAX_PARRALEL_REQUESTS);
            parallelChunks.push(chunk);
        }

        for (const chunk of parallelChunks) {
            const promises = chunk.map((ruleIps, i) => {
                return this.createRule(context, siteId, ruleIps, ruleName, ttl, i);
            });
            const results = await Promise.all(promises);
            rules = rules.concat(results);
        }

        return context.sendJson({ siteId, rules, ips: ipsValid }, 'out');
    },

    createRule: async function(context, siteId, ips, ruleName, ttl, i) {

        const filter = ips.map(ip => `ClientIP == ${ip}`).join(' & ');

        const { data } = await context.httpRequest({
            headers: {
                'x-API-Id': context.auth.id,
                'x-API-Key': context.auth.key
            },
            url: `${baseUrl}/v2/sites/${siteId}/rules`,
            method: 'POST',
            data: {
                name: ruleName + ' ' + i,
                filter,
                action: ACTION
            }
        });

        const rule = { ...data, siteId, batch: i };

        if (ttl) {
            const removeAfter = new Date().getTime() + ttl * 1000;
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
        }

        return rule;
    }
};
