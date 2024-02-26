'use strict';
const commons = require('../../asana-commons');

/**
 * Component for fetching list of workspaces
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getAsanaAPI(context.auth.accessToken);

        return client.workspaces.findAll()
            .then(res => {
                return context.sendJson(res.data, 'workspaces');
            });
    }
};
