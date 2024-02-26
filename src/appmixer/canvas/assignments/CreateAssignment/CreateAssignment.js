'use strict';
const Canvas = require('../../canvas-sdk');

module.exports = {

    async receive(context) {

        const {
            courseId,
            name,
            assignmentGroupId,
            description,
            position,
            submissionTypes,
            dueAt,
            lockAt,
            unlockAt,
            allowedExtensions,
            turnitinEnabled,
            turnitinSettings,
            vericiteEnabled,
            peerReviews,
            autoPeerReviews,
            notifyUpdates,
            pointsPossible,
            gradingType,
            omitFromFinalGrade,
            anonymousGrading,
            allowedAttempts
        } = context.messages.in.content;

        const { auth } = context;
        const accessToken = auth.accessToken;
        const client = new Canvas(accessToken, context);

        const { data } = await client.createAssignment(courseId, {
            name,
            assignment_group_id: assignmentGroupId,
            description,
            position,
            submission_types: submissionTypes,
            due_at: dueAt,
            lock_at: lockAt,
            unlock_at: unlockAt,
            allowed_extensions: allowedExtensions,
            turnitin_enabled: turnitinEnabled,
            turnitin_settings: turnitinSettings,
            vericite_enabled: vericiteEnabled,
            peer_reviews: peerReviews,
            automatic_peer_reviews: autoPeerReviews,
            notify_of_update: notifyUpdates,
            points_possible: pointsPossible,
            grading_type: gradingType,
            omit_from_final_grade: omitFromFinalGrade,
            anonymous_grading: anonymousGrading,
            allowed_attempts: allowedAttempts
        });

        return context.sendJson(data, 'out');
    }
}
