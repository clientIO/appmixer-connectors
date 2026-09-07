'use strict';
const commons = require('../lib');
const Promise = require('bluebird');

/**
 * Process events to find newly added.
 * @param {Set} knownEvents
 * @param {Array} currentEvents
 * @param {Array} newEvents
 * @param {Object} event
 */
function processEvents(knownEvents, currentEvents, newEvents, event) {

    if (knownEvents && !knownEvents.has(event['Id'])) {
        newEvents.push(event);
    }
    currentEvents.push(event['Id']);
}

const DATE_FIELDS = [
    'ActivityDateTime',
    'CreatedDate',
    'EndDateTime',
    'StartDateTime',
    'LastModifiedDate',
    'SystemModstamp',
    'ReminderDateTime'
];

/**
 * Reformat a raw event record's date fields to ISO. Shared by tick() and test()
 * so both emit an identically shaped event.
 * @param {Object} event
 * @return {Object} event
 */
function mapEvent(event) {
    return commons.formatFields(event, DATE_FIELDS, commons.formatDate);
}

/**
 * Component which triggers whenever new event is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let client = commons.getSalesforceAPI(context);
        let since = new Date();

        let res = await client.sobject('Event').find({
            CreatedDate: {
                $gte: commons.Date.toDateTimeLiteral(context.state.since || since)
            }
        });

        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (res.length) {
            res.forEach(processEvents.bind(null, known, current, diff));
        }

        await Promise.map(diff, event => {
            return context.sendJson(mapEvent(event), 'event');
        });

        await context.saveState({
            known: current,
            since: since
        });
    },

    async test(context) {

        const event = await commons.findLatestSObject(context, 'Event');
        if (!event) {
            throw new Error('No recent events to use as test data.');
        }
        return context.sendJson(mapEvent(event), 'event');
    }
};
