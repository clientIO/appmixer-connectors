'use strict';
const commons = require('../../wordpress-commons');

/**
 * Component for fetching list of sites
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return commons.getUserSites(context.auth.accessToken)
            .then(res => {
                return context.sendJson(res.sites, 'sites');
            });
    }
};
