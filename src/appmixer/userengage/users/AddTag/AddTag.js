'use strict';
const commons = require('../../userengage-commons');

/**
 * Tag a user in UserEngage.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;
        let { name, id } = context.messages.tag.content;

        return commons.getUserengageRequest(apiKey, 'users/' + id + '/add_tag', 'POST', { name }, 'form')
            .then(response => {
                // add user id to response data, so, user can chain this component to other actions
                response.user = { id };
                return context.sendJson(response, 'added');
            });
    }
};

