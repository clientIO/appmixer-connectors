'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListActivities
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const activitiesApi = commons.getPromisifiedClient(context.auth.apiKey, 'Activities');

        return activitiesApi.getAllAsync()
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(activity => activity.toObject()), 'out');
                }
            });
    }
};
