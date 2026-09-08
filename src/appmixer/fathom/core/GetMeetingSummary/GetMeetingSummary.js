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
            url: `${lib.API_BASE_URL}/recordings/${encodeURIComponent(recordingId)}/summary`,
            headers: lib.getHeaders(context)
        });

        // The API wraps the summary: { "summary": { template_name, markdown_formatted } }.
        // Unwrap it so the output matches this component's declared out-port schema —
        // otherwise those fields never resolve in the variable picker. `summary` is null
        // when the meeting has no AI summary yet.
        return context.sendJson((data && data.summary) || {}, 'out');
    }
};
