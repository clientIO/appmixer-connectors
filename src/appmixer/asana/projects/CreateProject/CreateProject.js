'use strict';
const commons = require('../../asana-commons');

// Hex code to Asana color name map
const hexToAsanaColorMap = {
    '#EA4E9D': 'dark-pink',
    '#62D26F': 'dark-green',
    '#4186E0': 'dark-blue',
    '#E8384F': 'dark-red',
    '#FD612C': 'dark-orange',
    '#7A6FF0': 'dark-purple',
    '#8DA3A6': 'dark-warm-gray',
    '#E362E3': 'light-pink',
    '#A4CF30': 'light-green',
    '#4186E0': 'light-blue',
    '#EEC300': 'light-yellow',
    '#FD9A00': 'light-orange',
    '#AA62E3': 'light-purple',
    '#8DA3A6': 'light-warm-gray',
    'none': 'none'
};


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

    // Map hex color to Asana color name
    if (project['color'] && project['color'] !== 'none') {
        projectObject['color'] = hexToAsanaColorMap[project['color']] || 'none'; // Fallback to 'null' if no match
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
