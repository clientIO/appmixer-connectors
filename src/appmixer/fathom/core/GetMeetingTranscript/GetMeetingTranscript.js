'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { recordingId } = context.messages.in.content;

        if (recordingId === undefined || recordingId === null || recordingId === '') {
            throw new context.CancelError('Recording ID is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            url: `${lib.API_BASE_URL}/recordings/${encodeURIComponent(recordingId)}/transcript`,
            headers: lib.getHeaders(context)
        });

        return context.sendJson(data, 'out');
    }
};
