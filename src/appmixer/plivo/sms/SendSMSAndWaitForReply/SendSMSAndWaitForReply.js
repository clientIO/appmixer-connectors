'use strict';
const Plivo = require('plivo');

async function registerWebhook(context, client) {

    const { appId } = await context.loadState();
    if (appId) {
        return { appId };
    }

    let response = await client.applications.create(
        // we need to be unique per component
        'appmixer-plivo-sms-SendSMSAndWaitForReply-' + context.componentId,
        { messageUrl: context.getWebhookUrl() }
    );

    if (response && response.message === 'created') {
        await context.stateSet('appId', response.appId);
        return response;
    } else {
        throw new Error(response);
    }
}

async function unregisterWebhook(context) {

    const { appId } = await context.loadState();
    if (appId) {
        const { accountSID, authenticationToken } = context.auth;
        const client = new Plivo.Client(accountSID, authenticationToken);

        try {
            return client.applications.delete(appId);
        } finally {
            await context.stateUnset('appId');
        }
    }
}

function bindPhoneNumber(client, appId, numberId) {

    return client.numbers.update(numberId, { appId });
}

/**
 * Component for sending SMS text messages through Plivo. It also waits for the response from target number.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.messages.timeout) {
            const { timeoutId } = context.messages.timeout.content;
            // Timeout key is always set to the messages "To" number
            const pendingKey = `pending-${timeoutId}`;
            const pending = await context.stateGet(pendingKey);
            if (!pending) {
                // If reply has already received and processed, we ignore this timeout
                return;
            }

            await context.sendJson({
                'From': pending.targetNumber,
                timeout: pending.timeout
            }, 'noResponse');

            return context.stateUnset(pendingKey);
        }

        // SUGGESTION: after resolving the issue with `only one application can be hooked to the number`
        // the webhook (un)registration should be done in receive method depending on count of `pending` responses

        if (context.messages.webhook) {
            const data = context.messages.webhook.content.data;
            const status = data['Status'];

            if (status) {
                // Status update on messages status
                const to = data['To'];
                const pendingKey = `pending-${to}`;
                if (status === 'delivered') {
                    const pending = await context.stateGet(pendingKey);
                    if (pending) {
                        // We use destination number as the timeoutId
                        await context.setTimeout({ timeoutId: to }, pending.timeout);
                    }
                }
            } else {
                // This when the target numbers replies to the SMS
                if (data['Text']) {
                    await context.sendJson(data, 'response');
                    // remove this pending item
                    await context.stateUnset(`pending-${data['From']}`);
                }
            }
            // Set response to avoid timeout on Plivo side
            return context.response();
        }

        // Get Auth ID and Auth Token https://console.plivo.com/dashboard/
        const { fromNumber } = context.properties;
        const { accountSID, authenticationToken } = context.auth;
        let { body, to, timeout = 5 } = context.messages.message.content;
        // timeout is in minutes, so transform it to milliseconds
        timeout *= (60 * 1000);
        const client = new Plivo.Client(accountSID, authenticationToken);

        await client.messages.create(fromNumber, to, body, { url: context.getWebhookUrl() });
        await context.stateSet(`pending-${to.replace('+', '')}`, { timeout, targetNumber: to });
    },

    async start(context) {

        const { accountSID, authenticationToken } = context.auth;
        const { fromNumber } = context.properties;
        const client = new Plivo.Client(accountSID, authenticationToken);
        const { appId } = await registerWebhook(context, client);
        return bindPhoneNumber(client, appId, fromNumber);
    },

    stop(context) {

        return unregisterWebhook(context);
    }
};
