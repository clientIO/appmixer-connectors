'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.categoryId) {
            throw new context.CancelError('Category ID is required!');
        }

        const { categoryId } = context.messages.in.content;

        const { data } = await apiCall(context, {
            url: `/solutions/categories/${categoryId}/folders`
        });

        return context.sendJson({ folders: data }, 'folders');
    }
};
