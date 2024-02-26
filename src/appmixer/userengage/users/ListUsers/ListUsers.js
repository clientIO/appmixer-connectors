'use strict';
const commons = require('../../userengage-commons');

/**
 * Component for fetching list of users
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;

        return commons.getUserengageRequest(apiKey, 'users', 'GET')
            .then(users => {
                return context.sendJson(users.results, 'users');
            });
    }
};

