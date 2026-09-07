'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

const calendar = GoogleApi.calendar('v3');
const listEvents = Promise.promisify(calendar.events.list, { context: calendar.events });

module.exports = {

    async receive(context) {

        const { calendarId, startTime, endTime, eventTypes } = context.messages.in.content;

        if (!calendarId) {
            throw new context.CancelError('Calendar is required!');
        }
        if (!startTime) {
            throw new context.CancelError('Start time is required!');
        }
        if (!endTime) {
            throw new context.CancelError('End time is required!');
        }

        // Fetch all events in the given time range
        const payload = {
            auth: commons.getOauth2Client(context.auth),
            quotaUser: context.auth.userId,
            calendarId: encodeURIComponent(calendarId),
            timeMin: startTime,
            timeMax: endTime,
            singleEvents: true,
            orderBy: 'startTime'
        };

        let data = await listEvents(payload);
        const items = data.items || [];

        // Filter to events that overlap with [startTime, endTime]
        const startMs = new Date(startTime).getTime();
        const endMs = new Date(endTime).getTime();

        // Determine which event types to consider. Default to ['default'] (regular events only).
        // Normalise: eventTypes may be a string (single value mapped from flow) or an array.
        const selectedTypes = eventTypes
            ? (Array.isArray(eventTypes) ? eventTypes : [eventTypes])
            : ['default'];

        const includeAllDay = selectedTypes.includes('allDay');

        // Filter to only the event types the user wants to consider.
        // Non-default eventTypes (workingLocation, outOfOffice, focusTime) take priority —
        // some of these are also stored as all-day events by Google, so we must check
        // eventType first to avoid misclassifying them as allDay.
        // The 'allDay' option only applies to regular (default) events that span a full day.
        const filteredEvents = items.filter(event => {
            const type = event.eventType || 'default';

            // Non-default event types: check against selectedTypes directly
            if (type !== 'default') {
                return selectedTypes.includes(type);
            }

            // Default event type: distinguish timed vs all-day by presence of dateTime
            const isAllDay = !event.start.dateTime;
            if (isAllDay) {
                return includeAllDay;
            }
            return selectedTypes.includes('default');
        });

        const overlapping = filteredEvents.filter(event => {
            const evStart = new Date(event.start.dateTime || event.start.date).getTime();
            const evEnd = new Date(event.end.dateTime || event.end.date).getTime();
            // Overlap condition: evStart < endMs && evEnd > startMs
            return evStart < endMs && evEnd > startMs;
        });

        if (overlapping.length === 0) {
            return context.sendJson({ available: true }, 'out');
        }

        const events = overlapping.map(event => {
            const isAllDay = !event.start.dateTime;
            return {
                id: event.id,
                summary: event.summary,
                description: event.description,
                location: event.location,
                start: commons.formatDate(event.start),
                end: commons.formatDate(event.end),
                // eventType reflects the Google API value (default, workingLocation, outOfOffice,
                // focusTime). isAllDay is a separate boolean — an event can be both all-day
                // AND have a non-default eventType (e.g. a workingLocation stored as all-day).
                eventType: event.eventType || 'default',
                isAllDay,
                status: event.status,
                htmlLink: event.htmlLink,
                creator: event.creator,
                organizer: event.organizer
            };
        });

        return context.sendJson({ available: false, events }, 'out');
    }
};
