'use strict';
const Blackboard = require('../../sdk');

module.exports = {

    async receive(context) {

        const {
            courseId,
            parentId,
            title,
            instructions,
            description,
            position,
            fileAttachments,
            available,
            allowGuests,
            allowObservers,
            adaptiveReleaseStart,
            adaptiveReleaseEnd,
            due,
            isUnlimitedAttemptsAllowed,
            attemptsAllowed,
            gradeSchemaId,
            score
        } = context.messages.in.content;

        const client = new Blackboard(
            context.auth.clientId,
            context.auth.clientSecret,
            context.config.serverUrl,
            context.auth.redirectUrl,
            context.httpRequest
        );

        client.setAccessToken(context.auth.accessToken);


        let fileUploadIds = [];
        if (fileAttachments) {
            const fileIds = fileAttachments.AND.reduce((acc, field) => {
                if (field.file) {
                    acc.push(field.file);
                }
                return acc;
            }, []);


            for (const fileId of fileIds) {
                const fileInfo = await context.getFileInfo(fileId);
                const fileStream = await context.getFileReadStream(fileId);

                const response = await client.uploadFile(fileStream, fileInfo);
                fileUploadIds.push(response.id);
            }
        }

        const data = await client.callApi('post', `/v1/courses/${courseId}/contents/createAssignment`, {
            parentId,
            title,
            instructions,
            description,
            position,
            fileUploadIds,
            availability: {
                available,
                allowGuests,
                allowObservers,
                adaptiveRelease: {
                    start: adaptiveReleaseStart,
                    end: adaptiveReleaseEnd
                }
            },
            grading: {
                due,
                gradeSchemaId,
                isUnlimitedAttemptsAllowed,
                attemptsAllowed
            },
            score: {
                possible: score
            }
        });
        return context.sendJson({
            assignmentId: data.contentId,
            gradeColumnId: data.gradeColumnId,
            attachmentIds: data.attachmentIds
        }, 'out');
    }
};
