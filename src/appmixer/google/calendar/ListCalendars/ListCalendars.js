'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const listCalendars = Promise.promisify(calendar.calendarList.list, { context: calendar.calendarList });

/**
 * Trigger for GMail when new email appears.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return listCalendars({
            auth: commons.getOauth2Client(context.auth),
            minAccessRole: 'writer',
            userId: 'me',
            quotaUser: context.auth.userId
        }).then((data) => {
            return context.sendJson(data, 'out');
        });
    }
};

