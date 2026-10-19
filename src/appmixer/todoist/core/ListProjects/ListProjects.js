'use strict';

const lib = require('../../lib');

// Schema of a single project item
const schema = {
    'id': { 'type': 'string', 'title': 'Project ID' },
    'name': { 'type': 'string', 'title': 'Name' },
    'color': { 'type': 'string', 'title': 'Color' },
    'parent_id': { 'type': 'string', 'title': 'Parent ID' },
    'order': { 'type': 'integer', 'title': 'Order' },
    'comment_count': { 'type': 'integer', 'title': 'Comment Count' },
    'is_shared': { 'type': 'boolean', 'title': 'Is Shared' },
    'is_favorite': { 'type': 'boolean', 'title': 'Is Favorite' },
    'is_inbox_project': { 'type': 'boolean', 'title': 'Is Inbox Project' },
    'is_team_inbox': { 'type': 'boolean', 'title': 'Is Team Inbox' },
    'view_style': { 'type': 'string', 'title': 'View Style' },
    'url': { 'type': 'string', 'title': 'URL' }
};

module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        // Handle dynamic output port generation
        if (context.properties.generateOutputPortOptions) {
            const options = lib.getOutputPortSchema(schema, outputType, 'Projects');
            return context.sendJson(options, 'out');
        }

        const projects = await lib.apiRequest(context, '/projects');

        console.log(     JSON.stringify(projects));

        return lib.sendArrayOutput({
            context,
            outputType: outputType || 'array',
            records: projects
        });
    }
};
