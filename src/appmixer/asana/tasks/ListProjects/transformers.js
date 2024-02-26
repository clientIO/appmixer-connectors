'use strict';

/**
 * Transformer for projects in workspace
 * @param {Object|string} projects
 */
module.exports.projectsToSelectArray = projects => {

    let transformed = [];

    if (Array.isArray(projects)) {
        projects.forEach(project => {

            transformed.push({
                label: project['name'],
                value: project['gid']
            });
        });
    }

    return transformed;
};
