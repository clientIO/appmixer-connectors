const CloudflareAPI = require('../../CloudflareAPI');
const lib = require('../lib');
const crypto = require('crypto');

module.exports = {
    async receive(context) {

        const { apiToken } = context.auth;
        const { zoneId } = context.properties;
        const { ips, ttl } = context.messages.in.content;

        if (ips.length === 0) {
            return context.sendJson([], 'out');
        }

        const parsedIps = Array.isArray(ips) ? ips : ips.split(',');
        const client = new CloudflareAPI({ zoneId, token: apiToken });

        const ruleset = (await client.listZoneRulesets(context))
            .find(ruleset => ruleset.kind === 'zone' && ruleset.phase === 'http_request_firewall_custom');

        let resultRules = []; // all affected rules - created or updated
        if (!ruleset) {
            const { data } = await client.createRulesetAndBlockRule(context, parsedIps);
            resultRules = data?.result?.rules || [];
        } else {
            const { result: { rules = [] } } = await client.getRules(context, ruleset.id);
            resultRules = rules;

            const rulesToUpdate = lib.prepareRulesForCreateOrUpdate(parsedIps, rules);

            const promises = rulesToUpdate.map(rule => {
                return rule.id ?
                    client.updateBlockRule(context, ruleset.id, rule) :
                    client.createBlockRule(context, { rulesetId: ruleset.id, rule });
            });

            (await Promise.allSettled(promises)).forEach(result => {
                updatedOrCreatedRules = result?.value?.result?.rules || [];
                updatedOrCreatedRules.forEach(rule => {
                    const index = resultRules.findIndex(r => r.id === rule.id);
                    if (index !== -1) {
                        resultRules[index] = rule;
                    } else {
                        resultRules.push(rule);
                    }
                });
            });
        }

        const updatedIps = lib.findIpsInRules(resultRules, parsedIps);
        const updatedIpsArray = Object.entries(updatedIps).map(([ip, { id }]) => ({ ip, ruleId: id }));

        if (ttl) {

            const removeAfter = new Date().getTime() + ttl * 1000;
            const dbItems = updatedIpsArray.map(item => {
                const { ip, ruleId } = item;
                return {
                    id: crypto.randomUUID(),
                    ip,
                    ruleId,
                    rulesetId: ruleset.id,
                    zoneId,
                    removeAfter,
                    auth: {
                        token: apiToken
                    }
                };
            });

            await context.callAppmixer({
                endPoint: '/plugins/appmixer/cloudflare/block-ip-rules',
                method: 'POST',
                body: { items: dbItems }
            });
        }

        return context.sendJson(updatedIpsArray, 'out');

    }
};
