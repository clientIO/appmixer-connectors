'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { name, description } = context.messages.in.content;

        const body = { name };
        if (description) body.description = description;

        const { data } = await apiCall(context, {
            method: 'POST',
            url: '/solutions/categories',
            data: body
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
