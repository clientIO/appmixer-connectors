'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const input = context.messages.in.content;

        if (lib.splitList(input.emailAddresses).length === 0) {
            throw new context.CancelError('Email Addresses is required!');
        }

        const values = lib.buildPersonValues(context, input);
        const record = await lib.upsertRecord(context, 'people', 'email_addresses', values);
        return context.sendJson(record, 'out');
    }
};
