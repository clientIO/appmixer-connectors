'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { folderId } = context.messages.in.content;

        const { data } = await apiCall(context, {
            url: `/solutions/folders/${folderId}`
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
