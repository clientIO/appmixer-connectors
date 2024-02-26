'use strict';
const { createClientFromContext } = require('../../sdk');

module.exports = {

    async receive(context) {

        const client = createClientFromContext(context);

        const assembler = (data) => {

            return data.reduce((acc, response) => {
                const { course = [] } = response || {};
                return acc.concat(course);
            }, []);
        };

        const data = await client.paginatedCall('get', '/courses', 200, assembler);

        return context.sendJson({ courses: data }, 'out');
    },

    toSelectArray({ courses }) {

        return courses.map(course => ({ label: course.title, value: course.id }));
    }
};
