'use strict';
const { createClientFromContext } = require('../../sdk');

function booleanToNumber(value) {

    return value ? 1 : 0;
}

module.exports = {

    async receive(context) {

        const {
            sectionId,
            title,
            description,
            due,
            gradeScaleId,
            gradeStats,
            showComments,
            allowDropbox,
            type,
            showRubric,
            gradingGroupIds,
            gradingCategoryId,
            gradingPeriodId,
            factor,
            maxPoints,
            published,
            allowDiscussion,
            isFinal
        } = context.messages.in.content;

        const client = createClientFromContext(context);
        const data = await client.apiRequest('post', `/sections/${sectionId}/assignments`, {}, {
            title,
            description,
            due,
            type,
            grading_category: gradingCategoryId,
            grading_period: gradingPeriodId,
            grading_scale: gradeScaleId,
            grading_group_ids: gradingGroupIds,
            grade_stats: gradeStats,
            show_comments: booleanToNumber(showComments),
            show_rubric: showRubric,
            factor,
            max_points: maxPoints,
            published: booleanToNumber(published),
            allow_discussion: booleanToNumber(allowDiscussion),
            allow_dropbox: booleanToNumber(allowDropbox),
            is_final: booleanToNumber(isFinal)
        });

        const output = {
            id: data.id,
            title: data.title,
            description: data.description,
            due: data.due,
            grading_scale: data.grading_scale,
            grading_period: data.grading_period,
            grading_category: data.grading_category,
            max_points: data.max_points,
            factor: data.factor,
            is_final: data.is_final,
            show_comments: data.show_comments,
            grade_stats: data.grade_stats,
            allow_dropbox: data.allow_dropbox,
            allow_discussion: data.allow_discussion,
            published: data.published,
            type: data.type,
            grade_item_id: data.grade_item_id,
            available: data.available,
            completed: data.completed,
            dropbox_locked: data.dropbox_locked,
            grading_scale_type: data.grading_scale_type,
            show_rubric: data.show_rubric,
            num_assignees: data.num_assignees,
            assignees: data.assignees,
            grading_group_ids: data.grading_group_ids,
            links: data.links
        }

        return context.sendJson(output, 'out');
    }
}
