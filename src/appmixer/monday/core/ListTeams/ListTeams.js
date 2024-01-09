'use strict';
const commons = require('../../monday-commons');
const queries = require('../../queries');

/**
 * Component for fetching list of boards.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const data = await commons.makeRequest({
            query: queries.listTeams,
            apiKey: context.auth.apiKey
        });
        const { teams } = data;
        return context.sendJson({ teams }, 'out');
    }
};

