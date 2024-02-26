'use strict';
const { createClientFromContext } = require('../../sdk');

module.exports = {

    async receive(context) {

        const { sectionId } = context.messages.in.content;
        const client = createClientFromContext(context);

        const data = await client.apiRequest('get', `/sections/${sectionId}/grading_scales`);
        return context.sendJson({ gradingScales: data.grading_scale }, 'out');
    },

    toSelectArray({ gradingScales }) {

        return gradingScales.map(scale => ({ label: scale.title, value: scale.id }));
    }
};
