'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { categoryId } = context.messages.in.content;

        const { data } = await apiCall(context, {
            url: `/solutions/categories/${categoryId}`
        });

        return context.sendJson({
            id: data.id,
            name: data.name,
            description: data.description,
            position: data.position,
            portalId: data.portal_id,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }, 'category');
    }
};
