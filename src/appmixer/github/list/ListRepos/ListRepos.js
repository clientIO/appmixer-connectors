'use strict';
const commons = require('../../github-commons');

/**
 * Component for fetching list of repositories
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let github = commons.getGithubAPI(context.auth.accessToken);

        return commons.getAll(github, 'repos', 'list')
            .then(res => {
                return context.sendJson(res, 'repositories');
            });
    }
};
