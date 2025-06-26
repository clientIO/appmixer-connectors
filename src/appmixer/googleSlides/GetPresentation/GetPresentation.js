'use strict';

module.exports = {
    async receive(context) {
        const { presentationId, fields } = context.messages.in.content;

        let encodedFields;
        if (fields) {
            encodedFields = fields.join(',');
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://slides.googleapis.com/v1/presentations/${presentationId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: {
                fields: encodedFields
            }
        });

        return context.sendJson(data, 'out');
    }
};
