'use strict';

const { sendArrayOutput } = require('../../microsoft-commons');

const PAGE_SIZE = 100;

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
            context.log({ step: 'Making request', options });

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

        if (outputType === 'object') {
            return context.sendJson(
                [
                    { label: '@odata.etag', value: '@odata.etag' },
                    { label: 'id', value: 'id' },
                    { label: 'createdDateTime', value: 'createdDateTime' },
                    { label: 'lastModifiedDateTime', value: 'lastModifiedDateTime' },
                    { label: 'changeKey', value: 'changeKey' },
                    { label: 'categories', value: 'categories',
                        schema: { type: 'array',
                            items: { type: 'object',
                                properties: {}
                            }
                        }
                    },
                    { label: 'transactionId', value: 'transactionId' },
                    { label: 'originalStartTimeZone', value: 'originalStartTimeZone' },
                    { label: 'originalEndTimeZone', value: 'originalEndTimeZone' },
                    { label: 'iCalUId', value: 'iCalUId' },
                    { label: 'reminderMinutesBeforeStart', value: 'reminderMinutesBeforeStart' },
                    { label: 'isReminderOn', value: 'isReminderOn' },
                    { label: 'hasAttachments', value: 'hasAttachments' },
                    { label: 'subject', value: 'subject' },
                    { label: 'bodyPreview', value: 'bodyPreview' },
                    { label: 'importance', value: 'importance' },
                    { label: 'sensitivity', value: 'sensitivity' },
                    { label: 'isAllDay', value: 'isAllDay' },
                    { label: 'isCancelled', value: 'isCancelled' },
                    { label: 'isOrganizer', value: 'isOrganizer' },
                    { label: 'responseRequested', value: 'responseRequested' },
                    { label: 'seriesMasterId', value: 'seriesMasterId' },
                    { label: 'showAs', value: 'showAs' },
                    { label: 'type', value: 'type' },
                    { label: 'webLink', value: 'webLink' },
                    { label: 'onlineMeetingUrl', value: 'onlineMeetingUrl' },
                    { label: 'isOnlineMeeting', value: 'isOnlineMeeting' },
                    { label: 'onlineMeetingProvider', value: 'onlineMeetingProvider' },
                    { label: 'allowNewTimeProposals', value: 'allowNewTimeProposals' },
                    { label: 'occurrenceId', value: 'occurrenceId' },
                    { label: 'isDraft', value: 'isDraft' },
                    { label: 'hideAttendees', value: 'hideAttendees' },
                    { label: 'responseStatus', value: 'responseStatus',
                        schema: { type: 'object',
                            properties: {
                                response: { label: 'response', value: 'response' },
                                time: { label: 'time', value: 'time' }
                            }
                        }
                    },
                    { label: 'body', value: 'body',
                        schema: { type: 'object',
                            properties: {
                                contentType: { label: 'contentType', value: 'contentType' },
                                content: { label: 'content', value: 'content' }
                            }
                        }
                    },
                    { label: 'start', value: 'start',
                        schema: { type: 'object',
                            properties: {
                                dateTime: { label: 'dateTime', value: 'dateTime' },
                                timeZone: { label: 'timeZone', value: 'timeZone' }
                            }
                        }
                    },
                    { label: 'end', value: 'end',
                        schema: { type: 'object',
                            properties: {
                                dateTime: { label: 'dateTime', value: 'dateTime' },
                                timeZone: { label: 'timeZone', value: 'timeZone' }
                            }
                        }
                    },
                    { label: 'location', value: 'location',
                        schema: { type: 'object',
                            properties: {
                                displayName: { label: 'displayName', value: 'displayName' },
                                locationType: { label: 'locationType', value: 'locationType' },
                                uniqueIdType: { label: 'uniqueIdType', value: 'uniqueIdType' },
                                address: { label: 'address', value: 'address',
                                    schema: { type: 'object',
                                        properties: {}
                                    }
                                },
                                coordinates: { label: 'coordinates', value: 'coordinates',
                                    schema: { type: 'object',
                                        properties: {}
                                    }
                                }
                            }
                        }
                    },
                    { label: 'locations', value: 'locations',
                        schema: { type: 'array',
                            items: { type: 'object',
                                properties: {}
                            }
                        }
                    },
                    { label: 'recurrence', value: 'recurrence' },
                    { label: 'attendees', value: 'attendees',
                        schema: { type: 'array',
                            items: { type: 'object',
                                properties: {}
                            }
                        }
                    },
                    { label: 'organizer', value: 'organizer',
                        schema: { type: 'object',
                            properties: {
                                emailAddress: { label: 'emailAddress', value: 'emailAddress',
                                    schema: { type: 'object',
                                        properties: {
                                            name: { label: 'name', value: 'name' },
                                            address: { label: 'address', value: 'address' }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    { label: 'onlineMeeting', value: 'onlineMeeting' },
                    { label: 'calendar@odata.associationLink', value: 'calendar@odata.associationLink' },
                    { label: 'calendar@odata.navigationLink', value: 'calendar@odata.navigationLink' }
                ],
                'out'
            );
        } else if (outputType === 'array') {
            return context.sendJson(
                [
                    {
                        label: 'Result', value: 'result',
                        schema: { type: 'array',
                            items: { type: 'object',
                                properties: {
                                    '@odata.etag': { type: 'string', title: '@odata.etag' },
                                    id: { type: 'string', title: 'id' },
                                    createdDateTime: { type: 'string', title: 'createdDateTime' },
                                    lastModifiedDateTime: { type: 'string', title: 'lastModifiedDateTime' },
                                    changeKey: { type: 'string', title: 'changeKey' },
                                    categories: { type: 'object', title: 'categories',
                                        schema: { type: 'array',
                                            items: { type: 'object',
                                                properties: {}
                                            }
                                        }
                                    },
                                    transactionId: { type: 'string', title: 'transactionId' },
                                    originalStartTimeZone: { type: 'string', title: 'originalStartTimeZone' },
                                    originalEndTimeZone: { type: 'string', title: 'originalEndTimeZone' },
                                    iCalUId: { type: 'string', title: 'iCalUId' },
                                    reminderMinutesBeforeStart: { type: 'number', title: 'reminderMinutesBeforeStart' },
                                    isReminderOn: { type: 'boolean', title: 'isReminderOn' },
                                    hasAttachments: { type: 'boolean', title: 'hasAttachments' },
                                    subject: { type: 'string', title: 'subject' },
                                    bodyPreview: { type: 'string', title: 'bodyPreview' },
                                    importance: { type: 'string', title: 'importance' },
                                    sensitivity: { type: 'string', title: 'sensitivity' },
                                    isAllDay: { type: 'boolean', title: 'isAllDay' },
                                    isCancelled: { type: 'boolean', title: 'isCancelled' },
                                    isOrganizer: { type: 'boolean', title: 'isOrganizer' },
                                    responseRequested: { type: 'boolean', title: 'responseRequested' },
                                    seriesMasterId: { type: 'object', title: 'seriesMasterId' },
                                    showAs: { type: 'string', title: 'showAs' },
                                    type: { type: 'string', title: 'type' },
                                    webLink: { type: 'string', title: 'webLink' },
                                    onlineMeetingUrl: { type: 'object', title: 'onlineMeetingUrl' },
                                    isOnlineMeeting: { type: 'boolean', title: 'isOnlineMeeting' },
                                    onlineMeetingProvider: { type: 'string', title: 'onlineMeetingProvider' },
                                    allowNewTimeProposals: { type: 'boolean', title: 'allowNewTimeProposals' },
                                    occurrenceId: { type: 'object', title: 'occurrenceId' },
                                    isDraft: { type: 'boolean', title: 'isDraft' },
                                    hideAttendees: { type: 'boolean', title: 'hideAttendees' },
                                    responseStatus: { type: 'object', title: 'responseStatus',
                                        schema: { type: 'object',
                                            properties: {
                                                response: { label: 'response', value: 'response' },
                                                time: { label: 'time', value: 'time' }
                                            }
                                        }
                                    },
                                    body: { type: 'object', title: 'body',
                                        schema: { type: 'object',
                                            properties: {
                                                contentType: { label: 'contentType', value: 'contentType' },
                                                content: { label: 'content', value: 'content' }
                                            }
                                        }
                                    },
                                    start: { type: 'object', title: 'start',
                                        schema: { type: 'object',
                                            properties: {
                                                dateTime: { label: 'dateTime', value: 'dateTime' },
                                                timeZone: { label: 'timeZone', value: 'timeZone' }
                                            }
                                        }
                                    },
                                    end: { type: 'object', title: 'end',
                                        schema: { type: 'object',
                                            properties: {
                                                dateTime: { label: 'dateTime', value: 'dateTime' },
                                                timeZone: { label: 'timeZone', value: 'timeZone' }
                                            }
                                        }
                                    },
                                    location: { type: 'object', title: 'location',
                                        schema: { type: 'object',
                                            properties: {
                                                displayName: { label: 'displayName', value: 'displayName' },
                                                locationType: { label: 'locationType', value: 'locationType' },
                                                uniqueIdType: { label: 'uniqueIdType', value: 'uniqueIdType' },
                                                address: { label: 'address', value: 'address',
                                                    schema: { type: 'object',
                                                        properties: {}
                                                    }
                                                },
                                                coordinates: { label: 'coordinates', value: 'coordinates',
                                                    schema: { type: 'object',
                                                        properties: {}
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    locations: { type: 'object', title: 'locations',
                                        schema: { type: 'array',
                                            items: { type: 'object',
                                                properties: {}
                                            }
                                        }
                                    },
                                    recurrence: { type: 'object', title: 'recurrence' },
                                    attendees: { type: 'object', title: 'attendees',
                                        schema: { type: 'array',
                                            items: { type: 'object',
                                                properties: {}
                                            }
                                        }
                                    },
                                    organizer: { type: 'object', title: 'organizer',
                                        schema: { type: 'object',
                                            properties: {
                                                emailAddress: { label: 'emailAddress', value: 'emailAddress',
                                                    schema: { type: 'object',
                                                        properties: {
                                                            name: { label: 'name', value: 'name' },
                                                            address: { label: 'address', value: 'address' }
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    },
                                    onlineMeeting: { type: 'object', title: 'onlineMeeting' },
                                    'calendar@odata.associationLink': { type: 'string', title: 'calendar@odata.associationLink' },
                                    'calendar@odata.navigationLink': { type: 'string', title: 'calendar@odata.navigationLink' }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
