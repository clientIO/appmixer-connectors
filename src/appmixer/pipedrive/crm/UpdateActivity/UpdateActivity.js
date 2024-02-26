'use strict';
const commons = require('../../pipedrive-commons');

/**
 * helper, makes sure, there is leading zero, when needed
 * @param  {number} v
 * @return {string}
 */
const norm = v => (v < 10 ? '0' : '') + v.toString();

/**
 * From the input message data, build request json
 * @param  {Object} data
 * @return {Object}
 */
function buildActivityJson(data) {

    data.type = data.activityType;
    delete data.activityType;

    let due = data.due;
    delete data.due;

    if (due) {
        due = due instanceof Date ? due : new Date(due);
        // Due date of the activity. Format: YYYY-MM-DD
        data['due_date'] = `${due.getFullYear()}-${due.getMonth() + 1}-${due.getDate()}`;
        // Due time of the activity in UTC. Format: HH:MM
        data['due_time'] = `${norm(due.getHours())}:${norm(due.getMinutes())}`;
    }

    return data;
}

/**
 * UpdateActivity action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const data = context.messages.activity.content;
        const activitiesApi = commons.getPromisifiedClient(context.auth.apiKey, 'Activities');

        const id = data.id;
        delete data.id;

        return activitiesApi.updateAsync(id, buildActivityJson(data))
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                return context.sendJson(response.data, 'updatedActivity');
            });
    }
};
