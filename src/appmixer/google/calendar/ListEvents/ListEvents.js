'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');

/**
 * This component lists all events in google calendar.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const listEvents = Promise.promisify(calendar.events.list, { context: calendar.events });

        return listEvents({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            calendarId: encodeURIComponent(context.properties.calendarId)
        }).then(data => {
            return context.sendJson(data, 'out');
        });
    }
};
