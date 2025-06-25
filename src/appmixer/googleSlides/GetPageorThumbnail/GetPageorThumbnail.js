'use strict';

module.exports = {
    async receive(context) {
        const { presentationId, pageObjectId, thumbnail } = context.messages.in.content;

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://slides.googleapis.com/v1/presentations/${presentationId}/pages/${pageObjectId}` + `${thumbnail ? '/thumbnail' : ''}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
