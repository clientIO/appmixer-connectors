'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const deleteEvent = Promise.promisify(calendar.events.delete, { context: calendar.events });

/**
 * Component for event deletion on google calendar.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return deleteEvent({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            calendarId: encodeURIComponent(context.messages.in.content.calendarId),
            eventId: encodeURIComponent(context.messages.in.content.eventId)
        }).then(() => {
            return context.sendJson({ eventId: context.messages.in.content.eventId }, 'deleted');
        });
    }
};
