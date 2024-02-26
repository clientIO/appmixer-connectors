'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const listEvents = Promise.promisify(calendar.events.list, { context: calendar.events });

const findEvents = async context => {

    // paging has to be used, even if the maxResults is lower than page number, google API
    // may return results on multiple pages. It is usual, that a first page returns 0 items,
    // but a nextPageToken and the event is on the next page
    async function getEvents(nextPageToken) {

        const payload = {
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            calendarId: encodeURIComponent(context.messages.in.content.calendarId),
            q: context.messages.in.content.query,
            maxResults: 250,
            ...(nextPageToken ? { pageToken: nextPageToken } : {})
        };

        let data = await listEvents(payload);

        const { nextPageToken: responsePageToken, items } = data;
        return { nextPageToken: responsePageToken, items };
    }

    let events = [];

    let { nextPageToken, items } = await getEvents();
    events = events.concat(items);
    while (nextPageToken) {
        const response = await getEvents(nextPageToken);
        nextPageToken = response.nextPageToken;
        events = events.concat(response.items);
    }

    return events;
};

/**
 * Trigger for GMail when new email appears.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const events = await findEvents(context);

        if (events.length === 0) {
            return context.sendJson({
                calendarId: encodeURIComponent(context.messages.in.content.calendarId),
                query: context.messages.in.content.query
            }, 'notFound');
        }

        return Promise.map(events, event => {
            event.start = commons.formatDate(event.start);
            event.end = commons.formatDate(event.end);
            return context.sendJson(
                Object.assign(
                    { calendarId: context.messages.in.content.calendarId },
                    event),
                'out');
        });
    }
};
