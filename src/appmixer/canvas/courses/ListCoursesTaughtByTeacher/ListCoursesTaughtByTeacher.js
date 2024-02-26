'use strict';

const Canvas = require("../../canvas-sdk");
module.exports = {

    async receive(context) {

        const { auth } = context;
        const accessToken = auth.accessToken;
        const client = new Canvas(accessToken, context);

        const { teacherId } = context.messages.in.content;
        const { data } = await client.listCoursesByUserId(teacherId);

        return context.sendJson({ courses: data }, 'out');
    }
}
