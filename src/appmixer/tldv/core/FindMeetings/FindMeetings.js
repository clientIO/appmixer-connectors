'use strict';

const lib = require('../../lib');

const schema = {
    id: { type: 'string', title: 'Meeting ID', example: '657f1e2b9a1c4d0012ab34cd' },
    name: { type: 'string', title: 'Name', example: 'Acme <> Widgets weekly sync' },
    happenedAt: { type: 'string', title: 'Happened At', example: '2025-01-15T10:30:00Z' },
    url: { type: 'string', title: 'tl;dv URL', example: 'https://tldv.io/app/meetings/657f1e2b9a1c4d0012ab34cd' },
    duration: { type: 'integer', title: 'Duration (seconds)', example: 1830 },
    organizer: { type: 'object', title: 'Organizer', example: { name: 'Jane Doe', email: 'jane@acme.com' } },
    invitees: { type: 'array', title: 'Invitees', example: [{ name: 'John Smith', email: 'john@widgets.com' }] },
    template: { type: 'object', title: 'Template', example: { id: 'tmpl_123', label: 'Sales Call' } },
    extraProperties: { type: 'object', title: 'Extra Properties', example: { conferenceId: 'abc-defg-hij' } }
};

module.exports = {

    async receive(context) {

        const { query, from, to, meetingType, onlyParticipated, outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Meetings', value: 'result' });
        }

        const params = {};
        if (query) {
            params.query = query;
        }
        if (from) {
            params.from = from;
        }
        if (to) {
            params.to = to;
        }
        if (meetingType) {
            params.meetingType = meetingType;
        }
        if (onlyParticipated === true) {
            params.onlyParticipated = true;
        }

        const meetings = await lib.fetchAllMeetings(context, params);

        if (meetings.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records: meetings });
    }
};
