'use strict';

const Canvas = require('../../canvas-sdk');
module.exports = {

    async receive(context) {

        const { auth } = context;
        const accessToken = auth.accessToken;
        const client = new Canvas(accessToken, context);

        const { courseId, enrollmentStatus, teacherId, gradingPeriodId, enrollmentTermId, enrollmentType } = context.messages.in.content;

        const { data } = await client.listCourseEnrollmentUsers(courseId, enrollmentStatus, teacherId, gradingPeriodId, enrollmentTermId, enrollmentType);

        return context.sendJson({ enrollments: data }, 'out');
    }
};
