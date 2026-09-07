'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { mailboxId } = context.messages.in.content;

        if (!mailboxId) {
            throw new context.CancelError('Mailbox ID is required!');
        }

        const response = await context.httpRequest({
            method: 'GET',
            url: `${lib.API_BASE_URL}/v2/mailboxes/${mailboxId}`,
            headers: lib.getHeaders(context)
        });

        const { details, ...rest } = response.data || {};
        return context.sendJson({ ...rest, ...details }, 'out');
    }
};
