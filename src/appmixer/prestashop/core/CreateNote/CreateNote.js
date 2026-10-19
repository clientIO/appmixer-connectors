/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { customerThreadId, note } = context.messages.in.content;

        if (!customerThreadId) {
            throw new context.CancelError('Customer Thread ID is required!');
        }
        if (!note) {
            throw new context.CancelError('Note is required!');
        }

        const xml = lib.buildResourceXml('customer_message', {
            id_customer_thread: customerThreadId,
            message: note,
            private: 1
        });

        const data = await lib.psRequest(context, {
            method: 'POST',
            path: '/customer_messages',
            data: xml,
            headers: { 'Content-Type': 'text/xml' }
        });

        return context.sendJson(data.customer_message || data, 'out');
    }
};
