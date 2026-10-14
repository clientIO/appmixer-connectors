'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let allAssignees = [];

        try {
            let peopleResp = await lib.callAPI(
                context,
                "GET",
                '/projects/api/v3/people.json',
                null,
                { page: 1, pageSize: 500 }
            );

            if (peopleResp && Array.isArray(peopleResp.people)) {
                peopleResp.people.forEach(person => {
                    allAssignees.push({
                        id: person.id,
                        name: `${person.firstName} ${person.lastName}`,
                        type: 'user'
                    });
                });
            }

            let teamsResp = await lib.callAPI(
                context,
                "GET",
                '/teams.json',
                null,
                {
                    includeCompanyTeams: true,
                    includeSubteams: true,
                    onlyGlobalTeamsWithProjectMembers: false
                }
            );

            if (teamsResp && Array.isArray(teamsResp.teams)) {
                teamsResp.teams.forEach(team => {
                    allAssignees.push({
                        id: team.id,
                        name: team.name,
                        type: 'team'
                    });
                });
            }

            let companiesResp = await lib.callAPI(
                context,
                "GET",
                '/projects/api/v3/companies.json',
                null,
                { page: 1, pageSize: 500 }
            );

            if (companiesResp && Array.isArray(companiesResp.companies)) {
                companiesResp.companies.forEach(company => {
                    allAssignees.push({
                        id: company.id,
                        name: company.name,
                        type: 'company'
                    });
                });
            }

            return context.sendJson({ assignees: allAssignees }, 'assignees');
        } catch (error) {
            throw new Error(`Error fetching assignees: ${error.message}`);
        }
    },

    toInspector: function(data) {
        let transformed = [{ label: 'Me (Current User)', value: 'user-me' }];
        if (data && Array.isArray(data.assignees)) {
            data.assignees.forEach(assignee => {
                let typeLabel = assignee.type === 'user' ? 'User' :
                               assignee.type === 'team' ? 'Team' : 'Company';
                transformed.push({
                    label: `${assignee.name} (${typeLabel})`,
                    value: `${assignee.type}-${assignee.id}`
                });
            });
        }
        return transformed;
    }

}
