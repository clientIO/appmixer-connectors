'use strict';
const qs = require('qs');
const Canvas = require('../../canvas-sdk');

module.exports = {
    async receive(context) {
        const { auth } = context;
        const accessToken = auth.accessToken;
        const client = new Canvas(accessToken, context);

        const {
            courseId,
            assignmentId,
            userId,
            isAnonymous,
            ...inputs
        } = context.messages.in.content;

        const form = {
            'comment[text_comment]': `${inputs.comment || ''}`,
            'comment[attempt]': `${inputs.attempt || ''}`,
            'comment[group_comment]': `${inputs.groupCommentFlag || ''}`,
            'include[visibility]': `${inputs.visibilityFlag || ''}`,
            'prefer_points_over_scheme': `${inputs.pointsOverSchemeFlag || ''}`,
            'submission[posted_grade]': `${inputs.submissionScore || ''}`,
            'submission[excuse]': `${inputs.submissionExcused || ''}`,
            'submission[late_policy_status]': inputs.latePolicyStatus || 'none',
            'submission[seconds_late_override]': `${inputs.lateSeconds || ''}`,
            'rubric_assessment': inputs.rubricAssessment || ''
        };

        const formBody = qs.stringify(form);
        const { data } = await client.updateSubmission(courseId, assignmentId, userId, isAnonymous, formBody);;

        return context.sendJson({ successFail: data }, 'out');

    }
};
