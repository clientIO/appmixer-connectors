'use strict';
const google = require('googleapis');
const googleCommons = require('../../google-commons');
const Promise = require('bluebird');

const calendar = google.calendar('v3');
const getCalendars = Promise.promisify(calendar.calendarList.list, { context: calendar.calendarList });

// Shared fetch: list the user's calendars. Both tick() and test() go through this so the
// emitted item shape stays identical.
function listCalendars(context) {

    return getCalendars({
        auth: googleCommons.getOauth2Client(context.auth),
        userId: 'me',
        quotaUser: context.auth.userId
    }).then(res => res['items'] || []);
}

module.exports = {

    tick(context) {

        return listCalendars(context).then(data => {
            let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
            let current = [];
            let diff = [];

            data.forEach(context.utils.processItem.bind(null, known, current, diff, calendar => calendar.id));
            context.state = { known: current };

            return Promise.map(diff, calendar => {
                return context.sendJson(calendar, 'calendar');
            });
        });
    },

    // Flow Test Mode: emit one realistic calendar without starting the flow. Uses the same
    // calendarList.list call and item shape as tick(); skips the state.known baseline (which
    // suppresses the first poll) so a real calendar is returned.
    async test(context) {

        const data = await listCalendars(context);
        const sample = data[data.length - 1];
        if (!sample) {
            throw new Error('No calendars to use as test data.');
        }
        return context.sendJson(sample, 'calendar');
    }
};
