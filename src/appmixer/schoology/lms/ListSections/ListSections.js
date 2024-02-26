'use strict';
const { createClientFromContext } = require('../../sdk');

module.exports = {

    async receive(context) {

        const { courseId } = context.messages.in.content;
        const client = createClientFromContext(context);

        const assembler = (data) => {

            return data.reduce((acc, response) => {
                const { section = [] } = response || {};
                return acc.concat(section);
            }, []);
        }

        const data = await client.paginatedCall('get', `/courses/${courseId}/sections`, 200, assembler);
        return context.sendJson({ sections: data }, 'out');
    },

    toSelectArray({ sections }) {

        return sections.map(section => ({ label: section.section_title, value: section.id }))
    }
}
