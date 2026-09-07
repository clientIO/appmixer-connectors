'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process teams to find newly added.
 * @param {Set} knownTeams
 * @param {Set} actualTeams
 * @param {Set} newTeams
 * @param {Object} team
 */
function processTeams(knownTeams, actualTeams, newTeams, team) {

    if (knownTeams && !knownTeams.has(team['gid'])) {
        newTeams.add(team);
    }
    actualTeams.add(team['gid']);
}

/**
 * Component which triggers whenever new team is added
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let workspaceId = context.properties.workspace;

        return client.teams.findByOrganization(workspaceId)
            .then(res => {

                let promises = [];
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.data.forEach(processTeams.bind(null, known, actual, diff));
                context.state = { known: Array.from(actual) };

                if (diff.size) {
                    diff.forEach(team => {
                        promises.push(client.teams.findById(team.gid));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                return Promise.map(data, team => {
                    return context.sendJson(team, 'team');
                });
            });
    },

    async test(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        const workspaceId = context.properties.workspace;

        // Same teams listing + findById path as tick(), picking the newest team.
        const res = await client.teams.findByOrganization(workspaceId);
        const latest = commons.pickLatest(res.data);
        if (!latest) {
            throw new Error('No recent teams to use as test data.');
        }
        const team = await client.teams.findById(latest.gid);
        return context.sendJson(team, 'team');
    }
};
