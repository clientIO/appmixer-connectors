'use strict';
const commons = require('../salesforce-commons');
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
            let dates = [
                'ActivityDateTime',
                'CreatedDate',
                'EndDateTime',
                'StartDateTime',
                'LastModifiedDate',
                'SystemModstamp',
                'ReminderDateTime'
            ];
            event = commons.formatFields(event, dates, commons.formatDate);
            return context.sendJson(event, 'event');
        });

        await context.saveState({
            known: current,
            since: since
        });
    }
};
