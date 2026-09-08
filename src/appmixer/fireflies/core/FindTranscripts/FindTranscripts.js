'use strict';

const lib = require('../../lib');

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

        const { keyword, fromDate, toDate, organizerEmail, participantEmail, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Transcripts' });
        }

        // `transcripts` caps `limit` at 50. Server-side sorting is not supported;
        // results come back newest-first. Deprecated filter fields (title/date)
        // are replaced by keyword/fromDate/toDate.
        const query = `
            query FindTranscripts(
                $keyword: String
                $fromDate: DateTime
                $toDate: DateTime
                $organizers: [String!]
                $participants: [String!]
                $limit: Int
            ) {
                transcripts(
                    keyword: $keyword
                    fromDate: $fromDate
                    toDate: $toDate
                    organizers: $organizers
                    participants: $participants
                    limit: $limit
                ) {
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

        const variables = { limit: 50 };
        if (keyword) variables.keyword = keyword;
        if (fromDate) variables.fromDate = fromDate;
        if (toDate) variables.toDate = toDate;
        if (organizerEmail) variables.organizers = [organizerEmail];
        if (participantEmail) variables.participants = [participantEmail];

        const data = await lib.makeRequest({ context, query, variables });
        const records = (data && data.transcripts) || [];

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
