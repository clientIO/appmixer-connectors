'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');
const moment = require('moment-timezone');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const listEvents = Promise.promisify(calendar.events.list, { context: calendar.events });

function getReminder(reminders = [], defaultReminder = { minutes: 0 }) {

    return (reminders.find(reminder => reminder.method === 'popup') || defaultReminder).minutes;
}

/**
 * @param {Object} event
 * @param {boolean} useReminders
 * @param {Object} triggered
 * @param {Object} defaultReminder
 * @param {number} tickPeriod
 * @return {boolean}
 */
function shouldTrigger(event, useReminders, triggered, defaultReminder, tickPeriod) {

    if (triggered[event.id] && triggered[event.id].updated === event.updated) {
        // event already triggered and nothing has changed on event record, do not fire again
        return false;
    }

    let now = new Date();
    let eventStart = new Date(event.start.dateTime || event.start.date);

    if (!useReminders) {
        // start of the event is either in the past or somewhere between now and next tick
        return Math.max(eventStart - now, 0) < tickPeriod;
    }

    // getReminder results in minutes before event start, so translate it to milliseconds
    let reminder = getReminder(event.reminders.overrides, { minutes: defaultReminder }) * 60 * 1000;
    // subtract the time user sets as offset for early notification
    return Math.max(new Date(eventStart.getTime() - reminder) - now, 0) < tickPeriod;
}

// Shared fetch: upcoming single events for a calendar in the [from, from + 4w] window. Both
// tick() and test() go through this so the emitted item shape stays identical.
function fetchUpcomingEvents(context, from) {

    return listEvents({
        auth: commons.getOauth2Client(context.auth),
        userId: 'me',
        quotaUser: context.auth.userId,
        calendarId: encodeURIComponent(context.properties.calendarId),
        singleEvents: true,
        // limits events start time to this range
        timeMin: from.toISOString(),
        // according to google api 4 weeks is maximum reminder time
        timeMax: moment(from).add(4, 'w').toISOString()
    });
}

// Normalize start/end dates the same way tick() does before emitting an event.
function normalizeEventDates(event) {

    event.start.date = new Date(event.start.date ? event.start.date : event.start.dateTime);
    event.end.date = new Date(event.end.date ? event.end.date : event.end.dateTime);
    return event;
}

/**
 * Component trigger, which fires when (before, if before reminders set) the event is set to start.
 */
module.exports = {

    tick(context) {

        const lastTick = context.messages.tick.content.lastTick || moment().utc();
        const tickPeriod = context.messages.tick.content.elapsed || 60000;

        let triggered = context.state.triggered || {};

        return fetchUpcomingEvents(context, lastTick).then(data => {

            let defaultReminder = getReminder(data.defaultReminders);
            let events = data?.items || [];

            return Promise.map(events, event => {
                if (shouldTrigger(event, context.properties.reminders, triggered, defaultReminder, tickPeriod)) {

                    // normalize start/end dates
                    normalizeEventDates(event);
                    triggered[event.id] = {
                        triggered: new Date(),
                        updated: event.updated
                    };
                    return context.sendJson(
                        Object.assign(
                            { calendarId: context.properties.calendarId },
                            event),
                        'out');
                }
            });
        }).then(() => {
            return context.saveState({ triggered });
        });
    },

    // Flow Test Mode: emit one realistic upcoming event without starting the flow. Uses the same
    // events.list fetch and `{ calendarId, ...event }` shape (with normalized start/end dates) as
    // tick(); skips the tick-window/reminder `shouldTrigger` gating (which suppresses output until
    // an event is actually about to start) so the soonest upcoming event is returned.
    async test(context) {

        const data = await fetchUpcomingEvents(context, moment().utc());
        const events = data?.items || [];
        const sample = events[0];
        if (!sample) {
            throw new Error('No upcoming events to use as test data.');
        }
        normalizeEventDates(sample);
        return context.sendJson(
            Object.assign({ calendarId: context.properties.calendarId }, sample),
            'out');
    }
};
