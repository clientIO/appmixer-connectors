'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const input = context.messages.in.content;

        const values = lib.buildCompanyValues(context, input);
        if (Object.keys(values).length === 0) {
            throw new context.CancelError('Provide at least one value for the company.');
        }

        const record = await lib.createRecord(context, 'companies', values);
        return context.sendJson(record, 'out');
    }
};
