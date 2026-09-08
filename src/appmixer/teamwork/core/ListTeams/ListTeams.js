'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function (context) {
        let { searchTerm } = context.messages.in.content;
        let q = {
            includeCompanyTeams: true,
            includeSubteams: true,
            onlyGlobalTeamsWithProjectMembers: false,
        }

        if (searchTerm !== null && searchTerm !== undefined) {
            q.searchTerm = searchTerm;
        }

        let allTeams = [];
        let page = 1;
        let pageSize = 500;
        let hasMore = true;

        try {
            while (hasMore) {
                q.page = page;
                q.pageSize = pageSize;

                let resp = await lib.callAPI(
                    context,
                    "GET",
                    '/teams.json',
                    null,
                    q
                );

                if (resp && Array.isArray(resp.teams)) {
                    allTeams = allTeams.concat(resp.teams);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching teams: ${error.message}`);
        }

        return context.sendJson({ teams: allTeams }, 'teams');
    },

    toInspector: function (data) {
        let transformed = [];
        if (Array.isArray(data.teams)) {
            data.teams.forEach(team => {
                transformed.push({
                    label: team.name,
                    value: team.id.toString()
                });
            });
        }

        return transformed;
    }
}
