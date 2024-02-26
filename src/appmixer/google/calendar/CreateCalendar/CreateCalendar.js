'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const insertCalendar = Promise.promisify(calendar.calendars.insert, { context: calendar.calendars });

/**
 * Component for calendar creation on google calendar.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return insertCalendar({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            resource: {
                summary: context.messages.in.content.summary,
                location: context.messages.in.content.location,
                description: context.messages.in.content.description,
                timeZone: context.messages.in.content.timeZone
            }
        }).then(response => {
            return context.sendJson(response, 'calendar');
        });
    }
};
