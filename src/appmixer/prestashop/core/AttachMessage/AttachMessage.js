/* eslint-disable camelcase */
'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { customerThreadId, message } = context.messages.in.content;

        if (!customerThreadId) {
            throw new context.CancelError('Customer Thread ID is required!');
        }
        if (!message) {
            throw new context.CancelError('Message is required!');
        }

        const xml = lib.buildResourceXml('customer_message', {
            id_customer_thread: customerThreadId,
            message,
            private: 0
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
