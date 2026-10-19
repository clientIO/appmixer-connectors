'use strict';

module.exports = {

    async receive(context) {

        const { folderId, fields } = context.messages.in.content;

        if (!folderId) {
            throw new context.CancelError('Folder ID is required!');
        }

        const params = {};
        if (fields) {
            params.fields = fields;
        }

        // https://developer.box.com/reference/get-folders-id/
        const { data } = await context.httpRequest({
            method: 'GET',
            url: `https://api.box.com/2.0/folders/${folderId}`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params
        });

        return context.sendJson(data, 'out');
    }
};
