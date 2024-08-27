'use strict';
const commons = require('../../personio-commons');

class PersonCreated {

    async receive(context) {
        if (context.messages.webhook) {
            const { data } = context.messages.webhook.content;
            await context.sendJson(data, 'out');
            return context.response('ok', 200);
        }
    }

    async start(context) {

        let accessToken = await commons.getBearerToken(context);
        const url = `https://api.personio.de/v2/webhooks`;

        try {
            const { data } = await context.httpRequest({
                url: url,
                method: 'POST',
                headers: {
                    'Authorization': 'Bearer ' + accessToken,
                    'Content-Type': 'application/json'
                },
                data: {
                    url: context.getWebhookUrl(),
                    description: 'Person Created Webhook',
                    status: 'ENABLED',
                    token: accessToken,
                    enabled_events: ['person.created']
                }
            });

            const id = 'id';
            return await context.stateSet(id, data.id);
        } catch (error) {
            // TODO: Add logging here
            throw error;
        }
    }


    async stop(context) {
        let access_token = await commons.getBearerToken(context);
        const url = ` https://api.personio.de/v2/webhooks`;
        const id = 'id';

        let ID = await context.stateGet(id);

        try {
            await context.httpRequest({
                url: `${url}/${ID}`,
                method: 'DELETE',
                headers: {
                    'Authorization': 'Bearer ' + access_token
                }
            });

            // Clear the saved state after successful deletion
        } catch (error) {
            // TODO: Add logging here
            throw error;
        } finally {
            // This will execute whether the try block succeeds or an error is caught
            await context.saveState({});
        }
    }
};

module.exports = new PersonCreated('maesn.personio.webhooks.PersonCreated');
