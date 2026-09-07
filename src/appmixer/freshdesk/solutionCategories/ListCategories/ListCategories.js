'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { data } = await apiCall(context, { url: '/solutions/categories' });

        return context.sendJson({ categories: data }, 'categories');
    }
};
