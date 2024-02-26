'use strict';
const Promise = require('bluebird');

module.exports = async context => {

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

                const registeredComponents = await context.service.stateGet(channelId);
                if (!registeredComponents) {
                    return {};
                }

                // we cannot wait for the results, 200 response has to be sent to slack within 3
                // seconds, otherwise they're gonna send retries
                Promise.map(registeredComponents, registered => {
                    return Promise.resolve(context.triggerComponent(
                        registered.flowId,
                        registered.componentId,
                        event,
                        req.query, {
                            method: 'POST',
                            hostname: req.info.hostname,
                            headers: req.headers
                        }
                    )).reflect();
                }, { concurrency: 100 }).each(inspection => {
                    if (!inspection.isFulfilled()) {
                        context.log('error', inspection.reason());
                    }
                }).catch(err => {
                    context.log('error', err.message, err);
                });

                return {};
            }
        }
    });
};
