'use strict';

const { makeRequest } = require('../commons');

module.exports = {

    async receive(context) {

        const { data } = await makeRequest(context, {
            path: '/me/outlook/masterCategories',
            method: 'GET'
        });
        return context.sendJson({ categories: data.value }, 'out');
    },
    categoriesToSelectArray({ categories }) {

        return categories.map(category => {
            return { label: category.displayName, value: category.displayName };
        });
    }
};

