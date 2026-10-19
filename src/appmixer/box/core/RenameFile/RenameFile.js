'use strict';

module.exports = {

    async receive(context) {

        const { fileId, name, ifMatch } = context.messages.in.content;

        // Validate required fields
        if (!fileId) {
            throw new context.CancelError('File ID is required!');
        }
        if (!name) {
            throw new context.CancelError('Name is required!');
        }

        const headers = {
            'Authorization': `Bearer ${context.auth.accessToken}`,
            'Content-Type': 'application/json'
        };

        // Add If-Match header if provided
        if (ifMatch) {
            headers['If-Match'] = ifMatch;
        }

        // https://developer.box.com/reference/put-files-id/
        const response = await context.httpRequest({
            method: 'PUT',
            url: `https://api.box.com/2.0/files/${fileId}`,
            headers: headers,
            data: {
                name: name
            }
        });

        return context.sendJson(response.data, 'out');
    }
};
