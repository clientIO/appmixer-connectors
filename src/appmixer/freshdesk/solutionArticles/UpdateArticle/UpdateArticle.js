'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { articleId, title, description, status, tags } = context.messages.in.content;

        const body = {};
        if (title) body.title = title;
        if (description) body.description = description;
        if (status !== undefined) body.status = status;
        if (tags) body.tags = tags.split(',').map(t => t.trim()).filter(Boolean);

        const { data } = await apiCall(context, {
            method: 'PUT',
            url: `/solutions/articles/${articleId}`,
            data: body
        });

        return context.sendJson({
            id: data.id,
            title: data.title,
            description: data.description,
            articleType: data.article_type,
            folderId: data.folder_id,
            categoryId: data.category_id,
            status: data.status,
            agentId: data.agent_id,
            tags: data.tags,
            createdAt: data.created_at,
            updatedAt: data.updated_at
        }, 'article');
    }
};
