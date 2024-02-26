'use strict';
const { createClientFromContext } = require('../../sdk');

module.exports = {

    async receive(context) {

        const { sectionId } = context.messages.in.content;
        const client = createClientFromContext(context);
        const data = await client.apiRequest('get', `/sections/${sectionId}/grading_categories`);

        return context.sendJson({ gradingCategories: data.grading_category }, 'out');
    },

    toSelectArray({ gradingCategories }) {

        const categories = gradingCategories.map(category => ({ label: category.title, value: category.id }));
        return [
            { label: 'Ungraded', value: 0 },
            ...categories
        ];
    }
};
