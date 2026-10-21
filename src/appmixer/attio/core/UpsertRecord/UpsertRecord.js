'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { objectId, matchingAttribute, values } = context.messages.in.content;

        if (!objectId) {
            throw new context.CancelError('Object is required!');
        }
        if (!matchingAttribute) {
            throw new context.CancelError('Matching Attribute is required!');
        }
        const parsedValues = lib.parseJsonObject(context, values, 'Values');
        if (!parsedValues) {
            throw new context.CancelError('Values is required!');
        }

        const record = await lib.upsertRecord(context, objectId, matchingAttribute, parsedValues);
        return context.sendJson(record, 'out');
    }
};
