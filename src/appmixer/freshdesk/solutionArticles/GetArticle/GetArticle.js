'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const { articleId } = context.messages.in.content;

        const { data } = await apiCall(context, {
            url: `/solutions/articles/${articleId}`
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
