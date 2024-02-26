'use strict';
const commons = require('../../asana-commons');
const Promise = require('bluebird');

/**
 * Process projects to find newly added.
 * @param {Set} knownProjects
 * @param {Set} actualProjects
 * @param {Set} newProjects
 * @param {Object} project
 */
function processProjects(knownProjects, actualProjects, newProjects, project) {

    if (knownProjects && !knownProjects.has(project['gid'])) {
        newProjects.add(project);
    }
    actualProjects.add(project['gid']);
}

/**
 * Component which triggers whenever new project is added
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        let workspaceId = context.properties.workspace;

        return client.projects.findAll({ workspace: workspaceId })
            .then(res => {
                let promises = [];
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.data.forEach(processProjects.bind(null, known, actual, diff));
                context.state = { known: Array.from(actual) };

                if (diff.size) {
                    diff.forEach(project => {
                        promises.push(client.projects.findById(project.gid));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                return Promise.map(data, project => {
                    return context.sendJson(project, 'project');
                });
            });
    }
};

