'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const { modelId } = context.messages.in.content;

        if (!modelId) {
            throw new context.CancelError('Model ID is required!');
        }

        const model = await lib.makeRequest({
            context,
            path: `/api/models/${lib.encodeRepoId(modelId)}`
        });

        return context.sendJson({
            id: model.id || model.modelId || modelId,
            author: model.author || String(modelId).split('/')[0],
            sha: model.sha || null,
            pipelineTag: model.pipeline_tag || null,
            libraryName: model.library_name || null,
            downloads: model.downloads || 0,
            likes: model.likes || 0,
            private: Boolean(model.private),
            gated: lib.normalizeGated(model.gated),
            disabled: Boolean(model.disabled),
            tags: model.tags || [],
            createdAt: model.createdAt || null,
            lastModified: model.lastModified || null,
            url: `${lib.HUB_API_BASE_URL}/${model.id || model.modelId || modelId}`
        }, 'out');
    }
};
