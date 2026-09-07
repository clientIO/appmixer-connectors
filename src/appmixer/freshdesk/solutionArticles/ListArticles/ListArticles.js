'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { folderId } = context.messages.in.content;

        const { data } = await apiCall(context, {
            url: `/solutions/folders/${folderId}/articles`
        });

        return context.sendJson({ articles: data }, 'articles');
    }
};
