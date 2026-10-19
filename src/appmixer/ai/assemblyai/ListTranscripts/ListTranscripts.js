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

const MAX_RECORDS = 1000;
const PAGE_LIMIT = 100;

module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Transcripts' });
        }

        const baseUrl = lib.getBaseUrl(context);
        const headers = lib.getHeaders(context);

        let url = `${baseUrl}/v2/transcript?limit=${PAGE_LIMIT}`;
        const records = [];

        while (url && records.length < MAX_RECORDS) {
            const { data } = await context.httpRequest({ method: 'GET', url, headers });
            const transcripts = (data && data.transcripts) || [];
            records.push(...transcripts);

            const nextUrl = data && data.page_details && data.page_details.next_url;
            if (!nextUrl || transcripts.length === 0) {
                break;
            }
            url = nextUrl.startsWith('http') ? nextUrl : `${baseUrl}${nextUrl}`;
        }

        return lib.sendArrayOutput({ context, records: records.slice(0, MAX_RECORDS), outputType });
    }
};
