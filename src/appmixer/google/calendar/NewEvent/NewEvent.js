'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const listEvents = Promise.promisify(calendar.events.list, { context: calendar.events });

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

        async function getEvents(nextPageToken) {

            const payload = {
                auth: commons.getOauth2Client(context.auth),
                userId: 'me',
                quotaUser: context.auth.userId,
                calendarId: encodeURIComponent(calendarId),
                orderBy: 'updated',
                singleEvents: false,    // treat recurring events as one
                showDeleted: false,
                updatedMin: since,
                maxResults: 30,
                ...(nextPageToken ? { pageToken: nextPageToken } : {})
            };

            let data = await listEvents(payload);

            const { nextPageToken: responsePageToken, items } = data;
            return { nextPageToken: responsePageToken, items };
        }

        let newItems = [];

        let { nextPageToken, items } = await getEvents();
        newItems = newItems.concat(items.filter(item => item.created > since));
        while (nextPageToken) {
            const response = await getEvents(nextPageToken);
            nextPageToken = response.nextPageToken;
            newItems = newItems.concat(response.items.filter(item => item.created > since));
        }

        await Promise.map(newItems, item => {
            return context.sendJson(Object.assign({ calendarId: calendarId }, item), 'out');
        }, { concurrency: 5 });

        await context.saveState({ since: now });
    }
};

