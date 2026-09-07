'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { folderId } = context.messages.in.content;

        await apiCall(context, {
            method: 'DELETE',
            url: `/solutions/folders/${folderId}`
        });

        return context.sendJson({ id: folderId }, 'deleted');
    }
};
