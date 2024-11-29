const { output, checkAndGetIfFirewallRulesetExists, handleResponseError } = require('./create-custom-rules-handler');
const ZoneCloudflareClient = require('../../ZoneCloudflareClient');
const lib = require('../../lib');

const OutputType = {
    SUCCESS: 'success',
    FAILURE: 'failure'
};

const messages = {
    nothingToUpdate: attackerId => {
        return `Rule for attacker Id ${attackerId} exists, nothing to update`;
    },
    ruleSuccessfullyUpdated: cloudflareResponse => {
        return `Updating Cloudflare WAF completed successfully. RuleID: ${cloudflareResponse.result.rules[0].id}`;
    },
    ruleSuccessfullyCreated: cloudflareResponse => {
        return `Adding Cloudflare WAF completed successfully. RuleID: ${cloudflareResponse.result.rules[0].id}`;
    },
    cloudflareUnknownError: err => {
        return `Cloudflare returned unknown error - status code: ${err.status}, message: ${err.message}.`;
    },
    noIps: 'No Ips to update',
    AuthenticationError:
        'Failed to authenticate to Cloudflare, please verify your credentials and try again.',
    ZoneIdNotFound:
        'Failed to add rule to zone - looks like it doesn\'t exist. Verify it and try again.'
};

module.exports = {
    async receive(context) {

        const { apiKey, apiToken, email } = context.auth;
        const { zoneId } = context.properties;
        const { ips, attackerId } = context.messages.in.content;

        if (ips.length === 0) {
            return output(context, messages.noIps, OutputType.SUCCESS);
        }

        const parsedIps = Array.isArray(ips) ? ips : ips.split(',');

        const client = new ZoneCloudflareClient({ email, apiKey, zoneId, token: apiToken });

        try {
            const ruleset = (await client.listZoneRulesets(context))
                .find(ruleset => ruleset.kind === 'zone' && ruleset.phase === 'http_request_firewall_custom');

            if (!ruleset) {
                const { data } = await client.createRulesetAndBlockRule(context, attackerId, parsedIps);
                return output(context, messages.ruleSuccessfullyCreated(data), OutputType.SUCCESS);
            }

            const { result: { rules = [] } } = await client.getRules(context, ruleset.id);

            const ipSet = lib.getIpsFromRules(rules);

            parsedIps.forEach(item => {
                ipSet.add(item);
            });

            const updatedRes = await client.updateBlockRule(
                context,
                ruleset.id,
                existingRule.id,
                attackerId,
                ipSet
            );

            return;
            // const [rulesetFromList, rulesetFromGet] = rulesetPair;
            // const existingRule = rulesetFromGet.result.rules.find(rule => {
            //     return rule.ref === client.getRuleRef(attackerId);
            // });

            if (existingRule && existingRule.expression === client.getBlockExpression(parsedIps)) {
                return output(context, messages.nothingToUpdate(attackerId), OutputType.SUCCESS);
            } else if (existingRule &&
                existingRule.expression !== client.getBlockExpression(parsedIps)) {

                const updatedRes = await client.updateBlockRule(
                    context,
                    rulesetFromList.id,
                    existingRule.id,
                    attackerId,
                    parsedIps
                );
                return output(context, messages.ruleSuccessfullyUpdated(updatedRes), OutputType.SUCCESS);
            } else {
                const createdRes = await client.createBlockRule(context, {
                    rulesetId: rulesetFromList.id,
                    attackerId,
                    ips: parsedIps
                });
                return output(context, messages.ruleSuccessfullyCreated(createdRes), OutputType.SUCCESS);
            }
        } catch (err) {
            return output(context, handleResponseError(context, err), OutputType.FAILURE);
        }
    }
};
