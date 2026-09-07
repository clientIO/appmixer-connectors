'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const listEvents = Promise.promisify(calendar.events.list, { context: calendar.events });

// Shared fetch: one page of events for a calendar. Both tick() and test() go through this so
// the emitted item shape stays identical. `updatedMin` is optional (test() omits the baseline).
async function getEvents(context, { calendarId, updatedMin, nextPageToken } = {}) {

    const payload = {
        auth: commons.getOauth2Client(context.auth),
        userId: 'me',
        quotaUser: context.auth.userId,
        calendarId: encodeURIComponent(calendarId),
        orderBy: 'updated',
        singleEvents: false,    // treat recurring events as one
        showDeleted: false,
        maxResults: 30,
        ...(updatedMin ? { updatedMin } : {}),
        ...(nextPageToken ? { pageToken: nextPageToken } : {})
    };

    const data = await listEvents(payload);
    const { nextPageToken: responsePageToken, items } = data;
    return { nextPageToken: responsePageToken, items: items || [] };
}

/**
 * Component for event creation on google calendar
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { calendarId } = context.properties;

        let now = new Date().toISOString();

        const state = await context.loadState();
        const since = state.since || now;

        let newItems = [];

        let { nextPageToken, items } = await getEvents(context, { calendarId, updatedMin: since });
        newItems = newItems.concat(items.filter(item => item.created > since));
        while (nextPageToken) {
            const response = await getEvents(context, { calendarId, updatedMin: since, nextPageToken });
            nextPageToken = response.nextPageToken;
            newItems = newItems.concat(response.items.filter(item => item.created > since));
        }

        await Promise.map(newItems, item => {
            return context.sendJson(Object.assign({ calendarId: calendarId }, item), 'out');
        }, { concurrency: 5 });

        await context.saveState({ since: now });
    },

    // Flow Test Mode: emit one realistic event without starting the flow. Uses the same
    // events.list fetch and `{ calendarId, ...event }` shape as tick(); skips the `since`
    // baseline (which filters out everything on the first poll) and picks the most recently
    // created event so a real item is returned.
    async test(context) {

        const { calendarId } = context.properties;

        const { items } = await getEvents(context, { calendarId });
        const sample = items
            .slice()
            .sort((a, b) => new Date(b.created) - new Date(a.created))[0];
        if (!sample) {
            throw new Error('No events to use as test data.');
        }
        return context.sendJson(Object.assign({ calendarId: calendarId }, sample), 'out');
    }
};

