'use strict';

const lib = require('../../lib');

// Schema of a single meeting item.
const schema = {
    'recording_id': { 'type': 'integer', 'title': 'Recording ID', 'example': 123456 },
    'title': { 'type': 'string', 'title': 'Title', 'example': 'Acme <> Fathom — Weekly Sync' },
    'meeting_title': { 'type': 'string', 'title': 'Meeting Title', 'example': 'Weekly Sync' },
    'meeting_type': { 'type': 'string', 'title': 'Meeting Type', 'example': 'external' },
    'url': { 'type': 'string', 'title': 'URL', 'example': 'https://fathom.video/calls/123456' },
    'share_url': { 'type': 'string', 'title': 'Share URL', 'example': 'https://fathom.video/share/abc123' },
    'created_at': { 'type': 'string', 'format': 'date-time', 'title': 'Created At', 'example': '2026-01-15T10:30:00Z' },
    'scheduled_start_time': { 'type': 'string', 'format': 'date-time', 'title': 'Scheduled Start Time', 'example': '2026-01-15T10:00:00Z' },
    'scheduled_end_time': { 'type': 'string', 'format': 'date-time', 'title': 'Scheduled End Time', 'example': '2026-01-15T10:30:00Z' },
    'recording_start_time': { 'type': 'string', 'format': 'date-time', 'title': 'Recording Start Time', 'example': '2026-01-15T10:02:00Z' },
    'recording_end_time': { 'type': 'string', 'format': 'date-time', 'title': 'Recording End Time', 'example': '2026-01-15T10:29:00Z' },
    'transcript_language': { 'type': 'string', 'title': 'Transcript Language', 'example': 'en' },
    'calendar_invitees_domains_type': { 'type': 'string', 'title': 'Invitee Domains Type', 'example': 'one_or_more_external' },
    'recorded_by': {
        'type': 'object',
        'title': 'Recorded By',
        'properties': {
            'name': { 'type': 'string', 'example': 'Jane Doe' },
            'email': { 'type': 'string', 'example': 'jane.doe@example.com' }
        }
    }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Meetings' });
        }

        const records = await lib.fetchAllPages(context, {
            url: `${lib.API_BASE_URL}/meetings`,
            headers: lib.getHeaders(context)
        });

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
