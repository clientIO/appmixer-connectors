'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * Process items to find newly added.
 * @param {Set} knownItems
 * @param {Set} actualItems
 * @param {Set} newItems
 * @param {Object} item
 */
function processItems(knownItems, actualItems, newItems, item) {

    if (knownItems && !knownItems.has(item.get('id'))) {
        newItems.push(item.toObject());
    }
    actualItems.push(item.get('id'));
}

/**
 * give me day before the 'date'
 * @param  {Date|undefined]} date
 * @return {string} the day before 'date' in YYYY-MM-DD format
 */
function dayBefore(date) {

    date = date || new Date();
    date.setDate(date.getDate() - 1);
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * NewActivity trigger.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        const activitiesApi = commons.getPromisifiedClient(context.auth.apiKey, 'Activities');
        // should be enough time to list new activities, because tick for trigger is 5 minutes
        const yesterday = dayBefore();

        let response = await activitiesApi.getAllAsync({
            'user_id': 0, // list activities for all users
            'start_date': yesterday // limit the search
        });
        if (response.success === false) {
            throw new context.CancelError(response.formattedError);
        }

        let activities = response.data;
        let knownState = context.state.known || {};
        let known = Array.isArray(knownState) ? new Set(knownState) : null;
        let actual = [];
        let diff = [];

        if (Array.isArray(activities)) {
            activities.forEach(processItems.bind(null, known, actual, diff));
        }

        await Promise.map(diff, item => {
            return context.sendJson(item, 'activity');
        });

        await context.saveState({ known: actual });
    }
};
