'use strict';

const Canvas = require('../../canvas-sdk');
module.exports = {

    async receive(context) {

        const { auth } = context;
        const accessToken = auth.accessToken;
        const client = new Canvas(accessToken, context);

        const { courseId } = context.messages.in.content;

        const { data } = await client.listAssignmentGroups(courseId);

        return context.sendJson({ assigmentGroups: data }, 'out');
    },

    toSelectArray({ assigmentGroups }) {
        return assigmentGroups.map(group => {
            return { label: group.name, value: group.id };
        });
    }
};
