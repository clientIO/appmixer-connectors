'use strict';

module.exports = {
    async receive(context) {
        const { presentationId, slideId } = context.messages.in.content;

        // https://developers.google.com/slides/api/reference/rest/v1/presentations/batchUpdate
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `https://slides.googleapis.com/v1/presentations/${presentationId}:batchUpdate`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            data: {
                requests: [
                    {
                        deleteObject: {
                            objectId: slideId
                        }
                    }
                ]
            }
        });

        const transformedResponse = {
            presentationId: data.presentationId,
            revisionId: data.writeControl.requiredRevisionId
        };

        return context.sendJson(transformedResponse, 'out');
    }
};
