'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { sandboxID, timeout } = context.messages.in.content;

        if (!sandboxID) {
            throw new context.CancelError('Sandbox ID is required!');
        }
        if (!timeout) {
            throw new context.CancelError('Timeout is required!');
        }

        await context.httpRequest({
            method: 'POST',
            url: `${lib.BASE_URL}/sandboxes/${encodeURIComponent(sandboxID)}/timeout`,
            headers: lib.authHeaders(context),
            data: { timeout }
        });

        return context.sendJson({}, 'out');
    }
};
