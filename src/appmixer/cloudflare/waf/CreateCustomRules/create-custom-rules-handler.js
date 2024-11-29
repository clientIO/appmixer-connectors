
function output(context, message, output) {
    return context.sendJson({ message }, output.valueOf());
}

function handleResponseError(context, err) {
    const cloudflareAuthenticationError = 'Authentication error';
    const zoneIdNotFoundError = new RegExp(
        'Could not route to /client/v4/zones/.*/rulesets, perhaps your object identifier is invalid?'
    );

    if (context.httpRequest.isAxiosError(err) && err.response) {
        const cloudflareResponse = err.response.data;
        const errorMessage = cloudflareResponse.errors
            ?.map(error => error.message).toString();
        const otherMessages = cloudflareResponse.messages
            ?.map(msg => msg.message).toString();
        if (errorMessage === cloudflareAuthenticationError) {
            return messages.AuthenticationError;
        } else if (zoneIdNotFoundError.test(errorMessage)) {
            return messages.ZoneIdNotFound;
        } else if (errorMessage) return errorMessage;
        else if (otherMessages) return otherMessages;
        else return messages.cloudflareUnknownError(err);
    } else if (err instanceof Error) {
        return err.message;
    } else {
        return 'Got unknown error when trying to send request to cloudflare server.';
    }
}

async function checkAndGetIfFirewallRulesetExists(
    context,
    client,
    rulesets
) {
    for (let ruleset of rulesets) {
        if (
            ruleset.kind === 'zone' &&
            ruleset.phase === 'http_request_firewall_custom'
        ) {
            const rulesetFromList = ruleset;

            try {
                console.log('VVVVVVVVVVVVVVvv', rulesetFromList);
                const validRulesetFromGet = await client.getRules(context, rulesetFromList.id);
                console.log(validRulesetFromGet);
                return [rulesetFromList, validRulesetFromGet];
            } catch (err) {
                console.log('!!!! -err-----------', err);
                await context.log({ message: err });
            }
        }
    }
}

module.exports = {
    getOrCreateRuleset: async function() {

    },
    output,
    // checkAndGetIfFirewallRulesetExists,
    handleResponseError
};
