'use strict';

const Canvas = require("../../canvas-sdk");
module.exports = {

    async receive(context) {

        const { auth } = context;
        const accessToken = auth.accessToken;
        const client = new Canvas(accessToken, context);

        const { data } = await client.listCourses();

        return context.sendJson({ courses: data }, 'out');
    },

    toSelectArray({ courses }) {
        return courses.map(course => {
            return { label: course.name, value: course.id }
        })
    }
}
