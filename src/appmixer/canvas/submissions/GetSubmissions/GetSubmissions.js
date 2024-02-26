'use strict';

const Canvas = require("../../canvas-sdk");
module.exports = {

    async receive(context) {

        const { auth } = context;
        const accessToken = auth.accessToken;
        const client = new Canvas(accessToken, context);

        const { courseId, assignmentId, userId, isAnonymous } = context.messages.in.content;

        const { data } = await client.getSubmissions(courseId, assignmentId, userId, isAnonymous);

        return context.sendJson({ submissions: Array.isArray(data) ? data : [data] }, 'out');
    }
}
