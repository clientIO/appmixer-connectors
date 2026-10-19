'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.folderId) {
            throw new context.CancelError('Folder ID is required!');
        }

        const { folderId } = context.messages.in.content;

        const { data } = await apiCall(context, {
            url: `/solutions/folders/${folderId}/articles`
        });

        return context.sendJson({ articles: data }, 'articles');
    }
};
