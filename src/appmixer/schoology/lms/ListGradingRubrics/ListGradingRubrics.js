'use strict';
const { createClientFromContext } = require('../../sdk');

module.exports = {

    async receive(context) {

        const { sectionId } = context.messages.in.content;
        const client = createClientFromContext(context);

        const data = await client.apiRequest('get', `/sections/${sectionId}/grading_rubrics`);
        return context.sendJson({ gradingRubrics: data.grading_rubric }, 'out');
    },

    toSelectArray({ gradingRubrics }) {

        return gradingRubrics.map(category => ({ label: category.title, value: category.id }));
    }
}
