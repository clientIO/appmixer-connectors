'use strict';
const lib = require('../../lib');

/**
 * Component for fetching list of repositories
 * https://docs.github.com/en/rest/repos/repos?apiVersion=2022-11-28#list-repositories-for-the-authenticated-user
 */
module.exports = {

    async receive(context) {

        const items = await lib.apiRequestPaginated(context, 'user/repos');
        return context.sendJson(items, 'repositories');
    }
};
