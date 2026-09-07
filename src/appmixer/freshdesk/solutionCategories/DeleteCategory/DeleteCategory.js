'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { categoryId } = context.messages.in.content;

        await apiCall(context, {
            method: 'DELETE',
            url: `/solutions/categories/${categoryId}`
        });

        return context.sendJson({ id: categoryId }, 'deleted');
    }
};
