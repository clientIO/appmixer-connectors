'use strict';
const commons = require('../../asana-commons');

/**
 * Build project.
 * @param {Object} project
 * @param {String} teamId
 * @param {String} workspaceId
 * @return {Object} projectObject
 */
function buildProject(project, teamId, workspaceId) {

    let projectObject = {
        workspace: workspaceId
    };

    if (project['name']) {
        projectObject['name'] = project['name'];
    }

    if (project['note']) {
        projectObject['notes'] = project['note'];
    }

    if (project['dueDate']) {
        projectObject['due_on'] = project['dueDate'];
    }

    if (project['color'] !== 'null') {
        projectObject['color'] = project['color'];
    }

    if (teamId) {
        projectObject['team'] = teamId;
    }

    return projectObject;
}

/**
 * Component which creates a new project if triggered.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getAsanaAPI(context.auth.accessToken);
        const { workspace, team } = context.messages.project.content;
        let project = context.messages.project.content;
        let projectObj = buildProject(project, team, workspace);

        return client.projects.create(projectObj)
            .then(project => {
                return context.sendJson(project, 'newProject');
            });
    }
};
