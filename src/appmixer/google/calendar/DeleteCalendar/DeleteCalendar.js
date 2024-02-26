'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const deleteCalendar = Promise.promisify(calendar.calendars.delete, { context: calendar.calendars });

/**
 * Component for calendar deletion.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return deleteCalendar({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            calendarId: encodeURIComponent(context.messages.in.content.calendarId)
        }).then(() => {
            return context.sendJson({ calendarId: context.messages.in.content.calendarId }, 'deleted');
        });
    }
};
