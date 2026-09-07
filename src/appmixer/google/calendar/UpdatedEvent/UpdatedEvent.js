'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const listEvents = Promise.promisify(calendar.events.list, { context: calendar.events });

// Shared fetch: one page of events for a calendar ordered by their last modification. Both
// tick() and test() go through this so the emitted item shape stays identical. `updatedMin` is
// optional (test() omits the baseline).
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

// An event counts as "updated" only when it was modified after the baseline AND it already
// existed before it (created on or before the baseline). This keeps brand-new events - which are
// the job of the NewEvent trigger - from also firing here.
function isUpdated(item, since) {

    // Compare parsed timestamps (ms) rather than RFC3339 strings: Google may return
    // timestamps with a timezone offset or different sub-second precision, for which
    // lexicographic ordering does not match chronological ordering.
    const sinceMs = new Date(since).getTime();
    return new Date(item.updated).getTime() > sinceMs && new Date(item.created).getTime() <= sinceMs;
}

/**
 * Component that fires any time an existing event was changed on your calendar.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const { calendarId } = context.properties;

        let now = new Date().toISOString();

        const state = await context.loadState();
        const since = state.since || now;

        let updatedItems = [];

        let { nextPageToken, items } = await getEvents(context, { calendarId, updatedMin: since });
        updatedItems = updatedItems.concat(items.filter(item => isUpdated(item, since)));
        while (nextPageToken) {
            const response = await getEvents(context, { calendarId, updatedMin: since, nextPageToken });
            nextPageToken = response.nextPageToken;
            updatedItems = updatedItems.concat(response.items.filter(item => isUpdated(item, since)));
        }

        await Promise.map(updatedItems, item => {
            return context.sendJson(Object.assign({ calendarId: calendarId }, item), 'out');
        }, { concurrency: 5 });

        await context.saveState({ since: now });
    },

    // Flow Test Mode: emit one realistic event without starting the flow. Uses the same
    // events.list fetch and `{ calendarId, ...event }` shape as tick(); skips the `since`
    // baseline (which filters out everything on the first poll) and picks the most recently
    // updated event so a real item is returned.
    async test(context) {

        const { calendarId } = context.properties;

        const { items } = await getEvents(context, { calendarId });
        const sample = items
            .slice()
            .sort((a, b) => new Date(b.updated) - new Date(a.updated))[0];
        if (!sample) {
            throw new Error('No events to use as test data.');
        }
        return context.sendJson(Object.assign({ calendarId: calendarId }, sample), 'out');
    }
};
