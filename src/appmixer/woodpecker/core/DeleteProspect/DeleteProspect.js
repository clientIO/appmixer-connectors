'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { prospectId } = context.messages.in.content;

        if (!prospectId) {
            throw new context.CancelError('Prospect ID is required!');
        }

        await context.httpRequest({
            method: 'DELETE',
            url: `${lib.API_BASE_URL}/v1/prospects`,
            headers: lib.getHeaders(context),
            params: { id: prospectId }
        });

        return context.sendJson({}, 'out');
    }
};
