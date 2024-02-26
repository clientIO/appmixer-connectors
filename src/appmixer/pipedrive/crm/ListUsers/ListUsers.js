'use strict';
const commons = require('../../pipedrive-commons');

/**
 * ListUsers
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const usersApi = commons.getPromisifiedClient(context.auth.apiKey, 'Users');

        return usersApi.getAllAsync({})
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                if (Array.isArray(response.data)) {
                    return context.sendJson(response.data.map(user => user.toObject()), 'out');
                }
            });
    }
};
