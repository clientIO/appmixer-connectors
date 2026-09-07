'use strict';

const { sendArrayOutput } = require('../../microsoft-commons');

const PAGE_SIZE = 100;

// Shared output schema of a MS Graph calendar event. Single source of truth for
// getOutputPortOptions() — every leaf carries type + title + example so the designer
// variable picker shows human labels and types instead of raw field names.
const eventSchema = {
    '@odata.etag': { type: 'string', title: 'ETag', example: 'W/"IMC6nOVUAEuLXdCeMDU5JQACEFyr7A=="' },
    id: { type: 'string', title: 'Event ID', example: 'AAMkADQ3YzRkMjgwLTNhM2YtNGM4Ni1iMWFkLTFm' },
    createdDateTime: { type: 'string', title: 'Created Date Time', example: '2026-07-02T14:43:10.63263Z' },
    lastModifiedDateTime: { type: 'string', title: 'Last Modified Date Time', example: '2026-07-02T14:43:12.5Z' },
    changeKey: { type: 'string', title: 'Change Key', example: 'IMC6nOVUAEuLXdCeMDU5JQACEFyr7A==' },
    categories: { type: 'array', title: 'Categories', items: { type: 'string' }, example: ['Red category'] },
    transactionId: { type: 'string', title: 'Transaction ID', example: '7E163156-7762-4BEB-A1C6-729EA81755A7' },
    originalStartTimeZone: { type: 'string', title: 'Original Start Time Zone', example: 'UTC' },
    originalEndTimeZone: { type: 'string', title: 'Original End Time Zone', example: 'UTC' },
    iCalUId: { type: 'string', title: 'iCal UID', example: '040000008200E00074C5B7101A82E00800000000' },
    reminderMinutesBeforeStart: { type: 'number', title: 'Reminder Minutes Before Start', example: 15 },
    isReminderOn: { type: 'boolean', title: 'Is Reminder On', example: true },
    hasAttachments: { type: 'boolean', title: 'Has Attachments', example: false },
    subject: { type: 'string', title: 'Subject', example: 'Team sync' },
    bodyPreview: { type: 'string', title: 'Body Preview', example: 'Agenda: quarterly review.' },
    importance: { type: 'string', title: 'Importance', example: 'normal' },
    sensitivity: { type: 'string', title: 'Sensitivity', example: 'normal' },
    isAllDay: { type: 'boolean', title: 'Is All Day', example: false },
    isCancelled: { type: 'boolean', title: 'Is Cancelled', example: false },
    isOrganizer: { type: 'boolean', title: 'Is Organizer', example: true },
    responseRequested: { type: 'boolean', title: 'Response Requested', example: true },
    seriesMasterId: { type: 'string', title: 'Series Master ID', example: 'AAMkADQ3YzRkMjgw' },
    showAs: { type: 'string', title: 'Show As', example: 'busy' },
    type: { type: 'string', title: 'Type', example: 'singleInstance' },
    webLink: { type: 'string', title: 'Web Link', example: 'https://outlook.office365.com/owa/?itemid=...' },
    onlineMeetingUrl: { type: 'string', title: 'Online Meeting URL', example: 'https://teams.microsoft.com/l/meetup-join/...' },
    isOnlineMeeting: { type: 'boolean', title: 'Is Online Meeting', example: false },
    onlineMeetingProvider: { type: 'string', title: 'Online Meeting Provider', example: 'teamsForBusiness' },
    allowNewTimeProposals: { type: 'boolean', title: 'Allow New Time Proposals', example: true },
    occurrenceId: { type: 'string', title: 'Occurrence ID', example: 'OID.AAMkADQ3YzRkMjgw' },
    isDraft: { type: 'boolean', title: 'Is Draft', example: false },
    hideAttendees: { type: 'boolean', title: 'Hide Attendees', example: false },
    responseStatus: {
        type: 'object', title: 'Response Status',
        properties: {
            response: { type: 'string', title: 'Response', example: 'organizer' },
            time: { type: 'string', title: 'Time', example: '0001-01-01T00:00:00Z' }
        }
    },
    body: {
        type: 'object', title: 'Body',
        properties: {
            contentType: { type: 'string', title: 'Content Type', example: 'html' },
            content: { type: 'string', title: 'Content', example: '<html><body>Agenda</body></html>' }
        }
    },
    start: {
        type: 'object', title: 'Start',
        properties: {
            dateTime: { type: 'string', title: 'Start Date Time', example: '2026-07-03T14:00:00.0000000' },
            timeZone: { type: 'string', title: 'Start Time Zone', example: 'UTC' }
        }
    },
    end: {
        type: 'object', title: 'End',
        properties: {
            dateTime: { type: 'string', title: 'End Date Time', example: '2026-07-03T15:00:00.0000000' },
            timeZone: { type: 'string', title: 'End Time Zone', example: 'UTC' }
        }
    },
    location: {
        type: 'object', title: 'Location',
        properties: {
            displayName: { type: 'string', title: 'Display Name', example: 'Prague office' },
            locationType: { type: 'string', title: 'Location Type', example: 'default' },
            uniqueIdType: { type: 'string', title: 'Unique ID Type', example: 'unknown' },
            address: { type: 'object', title: 'Address', properties: {} },
            coordinates: { type: 'object', title: 'Coordinates', properties: {} }
        }
    },
    locations: { type: 'array', title: 'Locations', items: { type: 'object', properties: {} }, example: [] },
    recurrence: { type: 'object', title: 'Recurrence', properties: {} },
    attendees: {
        type: 'array', title: 'Attendees',
        items: {
            type: 'object',
            properties: {
                type: { type: 'string', title: 'Type', example: 'required' },
                status: {
                    type: 'object', title: 'Status',
                    properties: {
                        response: { type: 'string', title: 'Response', example: 'accepted' },
                        time: { type: 'string', title: 'Time', example: '2026-07-02T14:45:00Z' }
                    }
                },
                emailAddress: {
                    type: 'object', title: 'Email Address',
                    properties: {
                        name: { type: 'string', title: 'Name', example: 'John Doe' },
                        address: { type: 'string', title: 'Address', example: 'john.doe@example.com' }
                    }
                }
            }
        }
    },
    organizer: {
        type: 'object', title: 'Organizer',
        properties: {
            emailAddress: {
                type: 'object', title: 'Email Address',
                properties: {
                    name: { type: 'string', title: 'Name', example: 'John Doe' },
                    address: { type: 'string', title: 'Address', example: 'john.doe@example.com' }
                }
            }
        }
    },
    onlineMeeting: { type: 'object', title: 'Online Meeting', properties: {} },
    'calendar@odata.associationLink': { type: 'string', title: 'Calendar Association Link', example: 'https://graph.microsoft.com/v1.0/me/calendars/...' },
    'calendar@odata.navigationLink': { type: 'string', title: 'Calendar Navigation Link', example: 'https://graph.microsoft.com/v1.0/me/calendars/...' }
};

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const {
            // TODO: Add support for different user's calendars.
            // calendarGroupId, calendarId,
            start, end, maxRecords,

            // Supports the OData Query Parameters that don't change the shape of the response.
            // `$search` is not supported for Events.
            filter, orderBy,

            // Appmixer specific
            outputType
        } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        // Path /me/events is the same as /me/calendar/events
        // By default, we list events from the default calendar.
        const url = 'https://graph.microsoft.com/v1.0/me/events';
        // if (calendarGroupId && calendarId) {
        //     url = `https://graph.microsoft.com/v1.0/me/calendarGroups/${calendarGroupId}/calendars/${calendarId}/events`;
        // } else if (calendarId) {
        //     url = `https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`;
        // }

        // Query params
        const urlWithQueryParams = new URL(url);

        // Construct a combined filter if no custom filter is provided
        let combinedFilter = '';
        if (filter) {
            // Use the custom filter if provided, ignoring start and end
            combinedFilter = filter;
        } else {
            // Combine start and end into a single filter if both are provided
            const filterConditions = [];
            if (start) {
                filterConditions.push(`start/dateTime ge '${start}'`);
            }
            if (end) {
                filterConditions.push(`end/dateTime le '${end}'`);
            }
            if (filterConditions.length > 0) {
                combinedFilter = filterConditions.join(' and ');
            }
        }

        // Append the combined filter to the query parameters
        if (combinedFilter) {
            urlWithQueryParams.searchParams.append('$filter', combinedFilter);
        }

        // Append orderBy if provided
        if (orderBy) {
            urlWithQueryParams.searchParams.append('$orderby', orderBy);
        }

        // Options for making the HTTP request
        const options = {
            url: urlWithQueryParams,
            headers: {
                Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
                accept: 'application/json'
            }
        };

        // Pagination and limit handling
        const MAX_LIMIT = maxRecords || 1000;
        let totalEvents = 0;
        let events = [];
        let nextLink = null;

        // Fetch events in a loop to handle pagination
        do {
            options.params = {
                top: Math.min(PAGE_SIZE, MAX_LIMIT - totalEvents),
                nextLink
            };

            const { data: result } = await context.httpRequest(options);
            events = events.concat(result.value);
            nextLink = result['@odata.nextLink'];
            totalEvents += result.value.length;
        } while (nextLink && totalEvents < MAX_LIMIT);

        // Check if there are no events and send an empty result
        if (events.length === 0) {
            return await context.sendJson({ messages: 'No data returned.', options }, 'emptyResult');
        }

        // Send the retrieved events as output
        return await sendArrayOutput({ context, outputType, records: events });
    },

    getOutputPortOptions(context, outputType) {

        // All variants are derived from the shared eventSchema — do not repeat field lists.
        if (outputType === 'object') {
            const options = Object.entries(eventSchema).map(([value, schema]) => ({
                label: schema.title || value, value, schema
            }));
            // sendArrayOutput() appends index/count to each emitted record.
            options.push(
                { label: 'Index', value: 'index', schema: { type: 'number', title: 'Index', example: 0 } },
                { label: 'Count', value: 'count', schema: { type: 'number', title: 'Count', example: 1 } }
            );
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            return context.sendJson([
                {
                    label: 'Result', value: 'result',
                    schema: { type: 'array', items: { type: 'object', properties: eventSchema } }
                },
                { label: 'Count', value: 'count', schema: { type: 'number', title: 'Count', example: 1 } }
            ], 'out');
        } else {
            // file
            return context.sendJson([
                { label: 'File ID', value: 'fileId', schema: { type: 'string', title: 'File ID', example: '5edf244a-6395-4f0b-b0c5-1bbef15f1e6a' } },
                { label: 'Count', value: 'count', schema: { type: 'number', title: 'Count', example: 1 } }
            ], 'out');
        }
    }
};
