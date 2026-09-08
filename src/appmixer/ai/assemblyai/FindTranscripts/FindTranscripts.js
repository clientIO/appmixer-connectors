'use strict';

const lib = require('../lib');

// Summary shape returned by the list endpoint (no text/words/utterances).
const schema = {
    id: { type: 'string', title: 'Transcript ID' },
    status: { type: 'string', title: 'Status' },
    audio_url: { type: 'string', title: 'Audio URL' },
    created: { type: 'string', title: 'Created' },
    completed: { type: 'string', title: 'Completed' },
    resource_url: { type: 'string', title: 'Resource URL' },
    error: { type: 'string', title: 'Error' }
};

module.exports = {

    async receive(context) {

        const { status, createdOn, outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Transcripts' });
        }

        const params = { limit: 200 };
        if (status) {
            params.status = status;
        }
        if (createdOn) {
            // The API expects an exact YYYY-MM-DD date.
            params.created_on = String(createdOn).substring(0, 10);
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `${lib.getBaseUrl(context)}/v2/transcript`,
            headers: lib.getHeaders(context),
            params
        });

        const transcripts = (data && data.transcripts) || [];

        if (transcripts.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: transcripts, outputType });
    }
};
