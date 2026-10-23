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

        await lib.apiRequest(context, {
            method: 'DELETE',
            path: '/v2/objects/' + encodeURIComponent(objectId) + '/records/' + encodeURIComponent(recordId)
        });

        return context.sendJson({}, 'out');
    }
};
