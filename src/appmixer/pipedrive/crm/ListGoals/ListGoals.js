'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListGoals
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const goalsApi = commons.getPromisifiedClient(context.auth.apiKey, 'Goals');
        const options = {
            'user_id': 0 // list all deals
        };

        return goalsApi.getAllAsync(options)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(goal => goal.toObject()), 'out');
                }
            });
    }
};
