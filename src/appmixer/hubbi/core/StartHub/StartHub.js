'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { conversionKey } = context.messages.in.content;

        if (!conversionKey) {
            throw new context.CancelError('Hub (Conversion Key) is required!');
        }

        // Fire-and-forget: HubsStart just kicks off the hub, there is no payload.
        await lib.hubbiRequest(context, {
            method: 'GET',
            endpoint: lib.ENDPOINTS.hubsStart,
            conversionKey
        });

        return context.sendJson({ conversionKey, started: true }, 'out');
    }
};
