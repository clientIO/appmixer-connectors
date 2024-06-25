'use strict';

module.exports = async context => {

    context.onListenerAdded(async listener => {

        // Components have to send the accessToken (not directly the Slack user_id) and
        // the accessToken is used to get the user_id. This way it is ensured that the
        // registered user_id belongs to the owner of the accessToken.

        const response = await context.httpRequest({
            method: 'GET',
            url: 'https://slack.com/api/auth.test',
            headers: {
                Authorization: `Bearer ${listener.params.accessToken}`
            }
        });

        if (response?.data?.ok === false) {
            throw new Error(response?.data?.error);
        }

        if (!response?.data['user_id']) {
            throw new Error('Missing user_id property.');
        }

        listener.params = {
            userId: response.data['user_id']
        };
    });

    context.http.router.register({
        method: 'POST',
        path: '/events',
        options: {
            auth: false,
            handler: async req => {

                if (req.payload.challenge) {
                    return { challenge: req.payload.challenge };
                }

                if (req.payload.type !== 'event_callback') {
                    return {};
                }

                const event = req.payload.event;
                if (!event) {
                    context.log('error', 'Missing event property.', req.payload);
                    return {};
                }

                const channelId = event.channel;
                if (!channelId) {
                    context.log('error', 'Missing channel property.', req.payload);
                    return {};
                }

                if (event.hidden) {
                    return {};
                }

                const response = await context.httpRequest({
                    method: 'POST',
                    url: 'https://slack.com/api/apps.event.authorizations.list',
                    headers: {
                        Authorization: `Bearer ${context.config.authToken}`
                    },
                    data: {
                        event_context: req.payload.event_context
                    }
                });

                if (response?.data?.ok === false) {
                    context.log('error', response?.data?.error);
                    return {};
                }

                const authorizedUsers = response.data.authorizations.map(item => item['user_id']);
                await context.triggerListeners({
                    eventName: channelId,
                    payload: event,
                    filter: listener => {
                        return authorizedUsers.indexOf(listener.params.userId) !== -1;
                    }
                });

                return {};
            }
        }
    });
};
