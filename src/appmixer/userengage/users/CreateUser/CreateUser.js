'use strict';
const commons = require('../../userengage-commons');

/**
 * Create new user in UserEngage.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;
        let user = context.messages.user.content;

        let data = {
            email: user.email,
            'first_name': user.firstName,
            'last_name': user.lastName
        };

        return commons.getUserengageRequest(apiKey, 'users', 'POST', data, 'form')
            .then(user => {
                // make CSV out of array properties
                user.tags = Array.isArray(user.tags) ? user.tags.join(',') : '';
                user.lists = Array.isArray(user.lists) ? user.lists.join(',') : '';

                return context.sendJson(user, 'newUser');
            });
    }
};

