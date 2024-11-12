'use strict';

const { validateEvents } = require('../validator');

/**
 * Component which creates new events on Google Analytics 4
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { clientId, measurementId, apiSecret, events } = context.messages.in.content;

        const transformedEvents = events.ADD.map(event => ({
            name: event.name,
            params: event.params ? JSON.parse(event.params) : undefined
        }));

        if (transformedEvents.length > 25) {
            throw new context.CancelError('Request can have a maximum of 25 events');
        }

        const errors = validateEvents(transformedEvents);

        if (errors.length > 0) {
            throw new context.CancelError(errors);
        }

        const qeuryParams = {
            measurement_id: measurementId, api_secret: apiSecret
        };
        const body = {
            client_id: clientId, events: transformedEvents
        };

        await context.httpRequest({
            method: 'POST',
            url: 'https://www.google-analytics.com/mp/collect',
            headers: {
                'Content-Type': 'application/json'
            },
            params: qeuryParams,
            data: JSON.stringify(body)
        });
    }
};
