'use strict';

module.exports = {
    async receive(context) {
        const { folderId } = context.messages.in.content;

        // https://developers.brevo.com/reference/deletefolder-1
        const { data } = await context.httpRequest({
            method: 'DELETE',
            url: `https://api.brevo.com/v3/contacts/folders/${folderId}`,
            headers: {
                'api-key': `${context.auth.apiKey}`
            }
        });

        return context.sendJson(data, 'out');
    }
};
