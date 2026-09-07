'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { categoryId, name, description, visibility } = context.messages.in.content;

        const body = { name };
        if (description !== undefined) body.description = description;
        if (visibility !== undefined) body.visibility = visibility;

        const { data } = await apiCall(context, {
            method: 'POST',
            url: `/solutions/categories/${categoryId}/folders`,
            data: body
        });

        return context.sendJson({
            id: data.id,
            name: data.name,
            description: data.description,
            categoryId: data.category_id,
            visibility: data.visibility,
            companyIds: data.company_ids,
            position: data.position,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }, 'folder');
    }
};
