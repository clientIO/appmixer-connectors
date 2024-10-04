'use strict';
const commons = require('../../asana-commons');

// Asana color names to hex code map
const asanaColorMap = {
    'dark-pink': '#EA4E9D',
    'dark-green': '#62D26F',
    'dark-blue': '#4186E0',
    'dark-red': '#E8384F',
    'dark-orange': '#FD612C',
    'dark-purple': '#7A6FF0',
    'light-pink': '#E362E3',
    'light-green': '#A4CF30',
    'light-blue': '#4186E0',
    'light-yellow': '#EEC300',
    'light-orange': '#FD9A00',
    'light-purple': '#AA62E3',
    'light-warm-gray': '#8DA3A6',
    'none': 'none' // No color selected
};

// Reverse map to convert hex to Asana API color names
const hexToAsanaColorMap = Object.fromEntries(
    Object.entries(asanaColorMap).map(([key, value]) => [value, key])
);

async function generateInspector(context) {
    const inspector = {
        schema: {
            type: 'object',
            properties: {
                workspace: { type: 'string' },
                team: { type: 'string' },
                name: { type: 'string' },
                note: { type: 'string' },
                dueDate: {
                    oneOf: [
                        { type: 'string', pattern: '^[0-9]{4}-[0|1][0-9]-[0-3][0-9]$' },
                        { type: 'string', format: 'date-time' }
                    ]
                },
                color: { type: 'string' }
            }
        },
        inputs: {
            workspace: {
                label: 'Workspace',
                type: 'select',
                tooltip: 'Select the workspace for the project.',
                source: {
                    url: '/component/appmixer/asana/tasks/ListWorkspaces?outPort=workspaces',
                    data: { transform: './transformers#workspacesToSelectArray' }
                },
                index: 1
            },
            team: {
                label: 'Team',
                type: 'select',
                tooltip: 'Select the team for the project.',
                source: {
                    url: '/component/appmixer/asana/tasks/ListTeams?outPort=teams',
                    data: {
                        messages: { 'in/workspace': 'inputs/project/workspace' },
                        transform: './transformers#teamsToSelectArray'
                    }
                },
                index: 2
            },
            name: {
                label: 'Name',
                type: 'text',
                tooltip: 'Enter the project name.',
                index: 3
            },
            note: {
                label: 'Notes',
                type: 'textarea',
                tooltip: 'Enter project notes.',
                index: 4
            },
            dueDate: {
                label: 'Due Date',
                type: 'date-time',
                tooltip: 'Select the project due date (or date-time).',
                index: 5
            },
            color: {
                label: 'Color',
                type: 'color-palette',
                options: Object.entries(asanaColorMap).map(([asanaColorName, hexValue]) => ({
                    value: hexValue,        // Use hex value as the value for the color palette
                    content: asanaColorName // Display Asana's color name as the content in the UI
                })),
                tooltip: 'Select the project color.',
                index: 6
            }
        }
    };

    return context.sendJson(inspector, 'newProject');
}

module.exports = {
    receive(context) {
        if (context.properties.generateInspector) {
            return generateInspector(context);
        }

        const client = commons.getAsanaAPI(context.auth.accessToken);
        const { workspace, team, color } = context.messages.project.content;
        let project = context.messages.project.content;

        // Map the selected hex value to the Asana API color name
        if (color && color !== 'none') {
            project.color = hexToAsanaColorMap[color] || 'none'; // Fallback to 'none' if mapping fails
        }

        let projectObj = buildProject(project, team, workspace);

        return client.projects.create(projectObj)
            .then(project => {
                return context.sendJson(project, 'newProject');
            });
    }
};

function buildProject(project, teamId, workspaceId) {
    let projectObject = { workspace: workspaceId };

    if (project.name) {
        projectObject.name = project.name;
    }

    if (project.note) {
        projectObject.notes = project.note;
    }

    if (project.dueDate) {
        projectObject.due_on = project.dueDate;
    }

    if (project.color && project.color !== 'none') {
        projectObject.color = project.color; // Send Asana color name to the API
    }

    if (teamId) {
        projectObject.team = teamId;
    }

    return projectObject;
}
