const { isAxiosError } = require('axios');
const { ZoneCloudflareClient } = require('./ZoneCloudflareClient');

const OutputType = {
    SUCCESS: 'success',
    FAILURE: 'failure'
};

const Messages = {
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

function output(context, message, output) {
    return context.sendJson({ message }, output.valueOf());
}

function handleResponseError(err) {
    const cloudflareAuthenticationError = 'Authentication error';
    const zoneIdNotFoundError = new RegExp(
        'Could not route to /client/v4/zones/.*/rulesets, perhaps your object identifier is invalid?'
    );

    if (isAxiosError(err) && err.response) {
        const cloudflareResponse = err.response.data;
        const errorMessage = cloudflareResponse.errors
            ?.map(error => error.message)
            .toString();
        const otherMessages = cloudflareResponse.messages
            ?.map(msg => msg.message)
            .toString();
        if (errorMessage === cloudflareAuthenticationError)
            return Messages.AuthenticationError;
        else if (zoneIdNotFoundError.test(errorMessage))
            return Messages.ZoneIdNotFound;
        else if (errorMessage) return errorMessage;
        else if (otherMessages) return otherMessages;
        else return Messages.cloudflareUnknownError(err);
    } else if (err instanceof Error) {
        return err.message;
    } else {
        return 'Got unknown error when trying to send request to cloudflare server.';
    }
}

async function checkAndGetIfFirewallRulesetExists(
    context,
    zoneCloudflareClient,
    rulesets
) {
    for (let ruleset of rulesets) {
        if (
            ruleset.kind === 'zone' &&
            ruleset.phase === 'http_request_firewall_custom'
        ) {
            const rulesetFromList = ruleset;

            try {
                const validRulesetFromGet = await zoneCloudflareClient.getRuleset(
                    rulesetFromList.id
                );
                return [rulesetFromList, validRulesetFromGet];
            } catch (err) {
                await context.log({ message: err });
            }
        }
    }
}

module.exports = {
    async handleReceived(context) {

        const { email, apiKey, zoneId } = context.properties;

        const { ips, attackerId } = context.messages.in.content;

        if (ips.length === 0) {
            return output(context, Messages.noIps, OutputType.SUCCESS);
        }

        const parsedIps = Array.isArray(ips) ? ips : ips.split(',');

        const zoneCloudflareClient = new ZoneCloudflareClient(email, apiKey, zoneId);

        try {
            const listOfRulesets = await zoneCloudflareClient.listZoneRulesetsForZoneId();
            const rulesetPair = await checkAndGetIfFirewallRulesetExists(
                context,
                zoneCloudflareClient,
                listOfRulesets
            );
            if (!rulesetPair) {
                const rulesetCreatedRes = await zoneCloudflareClient.createRulesetAndBlockRule(
                    attackerId,
                    parsedIps
                );
                return output(
                    context,
                    Messages.ruleSuccessfullyCreated(rulesetCreatedRes),
                    OutputType.SUCCESS
                );
            } else {
                const [rulesetFromList, rulesetFromGet] = rulesetPair;
                const existingRule = rulesetFromGet.result.rules.find(rule => {
                    return rule.ref === zoneCloudflareClient.getRuleRef(attackerId);
                });
                if (existingRule && existingRule.expression === zoneCloudflareClient.getBlockExpression(parsedIps)) {
                    return output(
                        context,
                        Messages.nothingToUpdate(attackerId),
                        OutputType.SUCCESS
                    );
                } else if (existingRule &&
                    existingRule.expression !== zoneCloudflareClient.getBlockExpression(parsedIps)) {

                    const updatedRes = await zoneCloudflareClient.updateBlockRule(
                        rulesetFromList.id,
                        existingRule.id,
                        attackerId,
                        parsedIps
                    );
                    return output(
                        context,
                        Messages.ruleSuccessfullyUpdated(updatedRes),
                        OutputType.SUCCESS
                    );
                } else {
                    const createdRes = await zoneCloudflareClient.createBlockRule(
                        rulesetFromList.id,
                        attackerId,
                        parsedIps
                    );
                    return output(
                        context,
                        Messages.ruleSuccessfullyCreated(createdRes),
                        OutputType.SUCCESS
                    );
                }
            }
        } catch (err) {
            return output(context, handleResponseError(err), OutputType.FAILURE);
        }
    }

};
