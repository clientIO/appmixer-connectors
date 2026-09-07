'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { articleId } = context.messages.in.content;

        await apiCall(context, {
            method: 'DELETE',
            url: `/solutions/articles/${articleId}`
        });

        return context.sendJson({ id: articleId }, 'deleted');
    }
};
