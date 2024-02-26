'use strict';
const commons = require('../../wordpress-commons');

/**
 * Component for fetching list of users
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let siteId = context.properties.siteId;
        const accessToken = context.auth.accessToken;

        return commons.getSiteUsers(
            {
                auth: { accessToken },
                siteId
            })
            .then(res => {
                return context.sendJson(res, 'users');
            });
    }
};
