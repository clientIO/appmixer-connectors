'use strict';
const commons = require('../../userengage-commons');

/**
 * Component for fetching list of templates.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;

        return commons.getUserengageRequest(apiKey, 'email-templates', 'GET')
            .then(templates => {
                return context.sendJson(templates.results, 'templates');
            });
    }
};

