'use strict';
const { createClientFromContext } = require('../../sdk');

module.exports = {

    async receive(context) {

        const { sectionId } = context.messages.in.content;
        const client = createClientFromContext(context);

        const data = await client.apiRequest('get', `/sections/${sectionId}/grading_groups`);
        return context.sendJson({ gradingGroups: data.grading_groups }, 'out');
    },

    toSelectArray({ gradingGroups }) {

        return gradingGroups.map(group => ({ label: group.title, value: group.id }));
    }
};
