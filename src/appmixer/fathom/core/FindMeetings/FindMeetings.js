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
    },
    'action_items': {
        'type': 'array',
        'title': 'Action Items',
        'items': { 'type': 'object' }
    },
    'highlights': {
        'type': 'array',
        'title': 'Highlights',
        'items': { 'type': 'object' }
    }
};

const toList = value => String(value).split(',').map(item => item.trim()).filter(Boolean);

module.exports = {

    async receive(context) {

        const {
            createdAfter,
            createdBefore,
            meetingType,
            recordedBy,
            teams,
            calendarInviteesDomains,
            calendarInviteesDomainsType,
            includeActionItems,
            includeHighlights,
            includeCrmMatches,
            outputType = 'array'
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Meetings' });
        }

        // Build the query string manually so array filters use Fathom's `key[]` convention.
        const query = new URLSearchParams();
        if (createdAfter) query.append('created_after', createdAfter);
        if (createdBefore) query.append('created_before', createdBefore);
        if (meetingType) query.append('meeting_type', meetingType);
        if (recordedBy) toList(recordedBy).forEach(v => query.append('recorded_by[]', v));
        if (teams) toList(teams).forEach(v => query.append('teams[]', v));
        if (calendarInviteesDomains) toList(calendarInviteesDomains).forEach(v => query.append('calendar_invitees_domains[]', v));
        if (calendarInviteesDomainsType) query.append('calendar_invitees_domains_type', calendarInviteesDomainsType);
        // include_summary / include_transcript are unavailable for OAuth apps and are intentionally omitted.
        if (includeActionItems) query.append('include_action_items', 'true');
        if (includeHighlights) query.append('include_highlights', 'true');
        if (includeCrmMatches) query.append('include_crm_matches', 'true');

        const queryString = query.toString();
        const url = `${lib.API_BASE_URL}/meetings${queryString ? `?${queryString}` : ''}`;

        const records = await lib.fetchAllPages(context, {
            url,
            headers: lib.getHeaders(context)
        });

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records });
    }
};
