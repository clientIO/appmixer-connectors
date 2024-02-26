'use strict';
const google = require('googleapis');
const googleCommons = require('../../google-commons');
const Promise = require('bluebird');

const calendar = google.calendar('v3');
const getCalendars = Promise.promisify(calendar.calendarList.list, { context: calendar.calendarList });

module.exports = {

    tick(context) {

        return getCalendars({
            auth: googleCommons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId
        }).then(res => {
            let data = res['items'];
            let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
            let current = [];
            let diff = [];

            data.forEach(context.utils.processItem.bind(null, known, current, diff, calendar => calendar.id));
            context.state = { known: current };

            return Promise.map(diff, calendar => {
                return context.sendJson(calendar, 'calendar');
            });
        });
    }
};
