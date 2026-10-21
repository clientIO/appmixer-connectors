'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { objectId, recordId } = context.messages.in.content;

        if (!objectId) {
            throw new context.CancelError('Object is required!');
        }
        if (!recordId) {
            throw new context.CancelError('Record ID is required!');
        }

        const record = await lib.getRecord(context, objectId, recordId);
        return context.sendJson(record, 'out');
    }
};
