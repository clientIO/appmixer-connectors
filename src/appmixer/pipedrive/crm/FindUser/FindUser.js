'use strict';
const commons = require('../../pipedrive-commons');
const Promise = require('bluebird');

/**
 * FindUser action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let data = context.messages.query.content;
        const usersApi = commons.getPromisifiedClient(context.auth.apiKey, 'Users');

        data['search_by_email'] = data.searchEmail ? 1 : 0;
        delete data.searchEmail;

        return usersApi.findAsync(data)
            .then(response => {
                if (response.success === false) {
                    throw new context.CancelError(response.formattedError);
                }
                context.log({ step: 'response data: ', response });
                if (Array.isArray(response.data) && response.data.length > 0) {
                    return Promise.map(response.data, user => {

                        return context.sendJson(user.toObject(), 'user');

                    });
                } else {
                    return context.sendJson({}, 'user');
                }
            });
    }
};
