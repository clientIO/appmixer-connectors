'use strict';

/**
 * Transformer for teams in workspace
 * @param {Object|string} teams
 */
module.exports.teamsToSelectArray = teams => {

    let transformed = [];

    if (Array.isArray(teams)) {
        teams.forEach(team => {

            transformed.push({
                label: team['name'],
                value: team['gid']
            });
        });
    }

    return transformed;
};
