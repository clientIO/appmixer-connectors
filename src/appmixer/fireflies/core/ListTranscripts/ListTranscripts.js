'use strict';

const lib = require('../../lib');

const PAGE_SIZE = 50;
const MAX_RECORDS = 500;

const schema = {
    'id': { 'type': 'string', 'title': 'Transcript ID' },
    'title': { 'type': 'string', 'title': 'Title' },
    'host_email': { 'type': 'string', 'title': 'Host Email' },
    'organizer_email': { 'type': 'string', 'title': 'Organizer Email' },
    'transcript_url': { 'type': 'string', 'title': 'Transcript URL' },
    'meeting_link': { 'type': 'string', 'title': 'Meeting Link' },
    'duration': { 'type': 'number', 'title': 'Duration (minutes)' },
    'dateString': { 'type': 'string', 'title': 'Date' },
    'date': { 'type': 'number', 'title': 'Date (epoch ms)' },
    'participants': { 'type': 'array', 'title': 'Participants' }
};

module.exports = {
    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Transcripts' });
        }

        // `transcripts` caps `limit` at 50, so we page with skip/limit until a
        // short page is returned or we reach MAX_RECORDS (a safety cap that keeps
        // us within Fireflies' restrictive daily request limits).
        const query = `
            query ListTranscripts($limit: Int, $skip: Int) {
                transcripts(limit: $limit, skip: $skip) {
                    id
                    title
                    host_email
                    organizer_email
                    transcript_url
                    meeting_link
                    duration
                    dateString
                    date
                    participants
                }
            }
        `;

        const records = [];
        let skip = 0;

        while (records.length < MAX_RECORDS) {
            const data = await lib.makeRequest({ context, query, variables: { limit: PAGE_SIZE, skip } });
            const page = (data && data.transcripts) || [];
            records.push(...page);

            if (page.length < PAGE_SIZE) {
                break;
            }
            skip += PAGE_SIZE;
        }

        return lib.sendArrayOutput({ context, records: records.slice(0, MAX_RECORDS), outputType });
    }
};
