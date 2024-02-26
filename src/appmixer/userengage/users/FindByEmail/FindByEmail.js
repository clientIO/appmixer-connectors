'use strict';
const commons = require('../../userengage-commons');
const nameParser = require('name-parser');

/**
 * Find user by email.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;
        let email = context.messages.user.email;

        return commons.getUserengageRequest(apiKey, 'users/search', 'GET', email, 'email')
            .then(result => {
                result.firstName = nameParser.parse(result.name)['firstName'];
                result.lastName = nameParser.parse(result.name)['lastName'];
                return context.sendJson(result, 'user');
            });
    }
};
