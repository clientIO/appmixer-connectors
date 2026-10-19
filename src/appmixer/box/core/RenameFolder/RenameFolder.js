'use strict';

module.exports = {

    async receive(context) {

        const { folderId, name, ifMatch } = context.messages.in.content;

        // Validate required inputs
        if (!folderId) {
            throw new context.CancelError('Folder Id is required!');
        }

        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const headers = {
            'Authorization': `Bearer ${context.auth.accessToken}`,
            'Content-Type': 'application/json'
        };

        // Add optional If-Match header if provided
        if (ifMatch) {
            headers['If-Match'] = ifMatch;
        }

        // https://developer.box.com/reference/put-folders-id/
        const response = await context.httpRequest({
            method: 'PUT',
            url: `https://api.box.com/2.0/folders/${folderId}`,
            headers: headers,
            data: {
                name: name
            }
        });

        return context.sendJson(response.data, 'out');
    }
};
