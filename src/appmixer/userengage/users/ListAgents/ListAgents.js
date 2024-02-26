'use strict';
const commons = require('../../userengage-commons');

/**
 * Component for fetching list of agents
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;

        return commons.getUserengageRequest(apiKey, 'application', 'GET')
            .then(agents => {
                return context.sendJson(agents.agents, 'agents');
            });
    }
};

