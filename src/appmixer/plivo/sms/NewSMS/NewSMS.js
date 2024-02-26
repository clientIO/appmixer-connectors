'use strict';
const Plivo = require('plivo');

async function registerWebhook(context, client) {

    let response = await client.applications.create(
        // we need to be unique per component
        'appmixer.plivo.sms.NewSMS.' + context.componentId,
        { messageUrl: context.getWebhookUrl() }
    );
    if (response && response.message === 'created') {
        await context.saveState({ appId: response.appId });
        return response;
    } else {
        throw new Error(response);
    }
}

function unregisterWebhook(context, client) {

    const removeAppId = () => context.state = {};
    if (context.state.appId) {
        const { accountSID, authenticationToken } = context.auth;
        const client = new Plivo.Client(accountSID, authenticationToken);

        return client.applications.delete(context.state.appId)
        // remove from state in every case
        // TODO: look at cases, in which we don NOT want to remove it
            .then(removeAppId)
            .catch(removeAppId);
    }
}

function bindPhoneNumber(client, appId, numberId) {

    return client.numbers.update(numberId, { appId });
}

module.exports = {

    receive(context) {

        if (context.messages.webhook) {
            return context.sendJson(context.messages.webhook.content.data, 'sms');
        }
    },

    async start(context) {

        const { accountSID, authenticationToken } = context.auth;
        const { phoneNumber } = context.properties;
        const client = new Plivo.Client(accountSID, authenticationToken);
        const application = await registerWebhook(context, client);
        return bindPhoneNumber(client, application.appId, phoneNumber);
    },

    stop(context) {

        const { accountSID, authenticationToken } = context.auth;
        const client = new Plivo.Client(accountSID, authenticationToken);
        return unregisterWebhook(context, client);
    }
};
