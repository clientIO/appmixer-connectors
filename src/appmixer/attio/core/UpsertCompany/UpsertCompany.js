'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const input = context.messages.in.content;

        if (lib.splitList(input.domains).length === 0) {
            throw new context.CancelError('Domains is required!');
        }

        const values = lib.buildCompanyValues(context, input);
        const record = await lib.upsertRecord(context, 'companies', 'domains', values);
        return context.sendJson(record, 'out');
    }
};
