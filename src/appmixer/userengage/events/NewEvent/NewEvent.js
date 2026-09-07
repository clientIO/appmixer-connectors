'use strict';
const commons = require('../../userengage-commons');
const Promise = require('bluebird');

/**
 * Process events to find newly added.
 * @param {Set} knownEvents
 * @param {Array} currentEvents
 * @param {Array} newEvents
 * @param {Object} event
 */
function processUsers(knownEvents, currentEvents, newEvents, event) {

    if (knownEvents && !knownEvents.has(event['id'])) {
        newEvents.push(event);
    }
    currentEvents.push(event['id']);
}

/**
 * Fetch the detail for an event and merge it with the list entry, producing the exact
 * shape emitted on the 'event' port. Shared by tick() and test().
 * @param {Object} context
 * @param {string} apiKey
 * @param {Object} event - the event entry from the 'events' list
 * @return {Promise<Object|null>}
 */
async function fetchEventDetail(context, apiKey, event) {

    const response = await commons.getUserengageRequest(apiKey, 'events/' + event.id, 'GET');
    if (response && Array.isArray(response.results)) {
        return Object.assign(response.results[0] || {}, event);
    }
    return null;
}

/**
 * Component which triggers whenever new event is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { apiKey } = context.auth;

        let events = await commons.getUserengageRequest(apiKey, 'events', 'GET');
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (events.results.length) {
            events.results.forEach(processUsers.bind(null, known, current, diff));
        }

        await Promise.map(diff, event => {
            return fetchEventDetail(context, apiKey, event)
                .then(eventDetail => {
                    if (eventDetail) {
                        return context.sendJson(eventDetail, 'event');
                    }
                });
        });

        await context.saveState({ known: current });
    },

    async test(context) {

        let { apiKey } = context.auth;

        // Same list endpoint tick() polls; take the freshest event. No state.
        let event = await commons.getLatestResult(apiKey, 'events');
        if (!event) {
            throw new Error('No recent events to use as test data.');
        }
        // Same detail-fetch + merge mapping tick() applies before emitting.
        let eventDetail = await fetchEventDetail(context, apiKey, event);
        if (!eventDetail) {
            throw new Error('No recent events to use as test data.');
        }
        return context.sendJson(eventDetail, 'event');
    }
};
