'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { sandboxID } = context.messages.in.content;

        if (!sandboxID) {
            throw new context.CancelError('Sandbox ID is required!');
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.BASE_URL}/sandboxes/${encodeURIComponent(sandboxID)}`,
            headers: lib.authHeaders(context)
        });

        return context.sendJson(data, 'out');
    }
};
