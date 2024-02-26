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
            return commons.getUserengageRequest(apiKey, 'events/' + event.id, 'GET')
                .then(response => {
                    if (response && Array.isArray(response.results)) {
                        const eventDetail = Object.assign(response.results[0] || {}, event);
                        return context.sendJson(eventDetail, 'event');
                    }
                });
        });

        await context.saveState({ known: current });
    }
};
