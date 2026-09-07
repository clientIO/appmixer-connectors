'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const patchEvent = Promise.promisify(calendar.events.patch, { context: calendar.events });

/**
 * Component for accepting a calendar event invitation on Google Calendar.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const { calendarId, eventId, attendeeEmail, sendUpdates } = context.messages.in.content;

        if (!calendarId) {
            throw new context.CancelError('Calendar is required!');
        }
        if (!eventId) {
            throw new context.CancelError('Event is required!');
        }
        if (!attendeeEmail) {
            throw new context.CancelError('Attendee Email is required!');
        }

        const params = {
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            calendarId: encodeURIComponent(calendarId),
            eventId: encodeURIComponent(eventId),
            resource: {
                attendees: [
                    {
                        email: attendeeEmail,
                        responseStatus: 'accepted'
                    }
                ]
            }
        };

        if (sendUpdates) {
            params.sendUpdates = sendUpdates;
        }

        return patchEvent(params).then(result => {
            return context.sendJson(
                Object.assign({ calendarId }, result),
                'out'
            );
        });
    }
};
