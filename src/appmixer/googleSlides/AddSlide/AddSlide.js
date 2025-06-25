'use strict';

module.exports = {
    async receive(context) {
        const { presentationId } = context.messages.in.content;

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
                        createSlide: {
                            slideLayoutReference: {
                                predefinedLayout: 'BLANK'
                            }
                        }
                    }
                ]
            }
        });

        const transformedResponse = {
            presentationId: data.presentationId,
            revisionId: data.writeControl.requiredRevisionId,
            slideId: data.replies[0].createSlide.objectId
        };

        return context.sendJson(transformedResponse, 'out');
    }
};
