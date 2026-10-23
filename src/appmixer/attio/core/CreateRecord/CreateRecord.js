'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { objectId, values } = context.messages.in.content;

        if (!objectId) {
            throw new context.CancelError('Object is required!');
        }
        const parsedValues = lib.parseJsonObject(context, values, 'Values');
        if (!parsedValues) {
            throw new context.CancelError('Values is required!');
        }

        const record = await lib.createRecord(context, objectId, parsedValues);
        return context.sendJson(record, 'out');
    }
};
