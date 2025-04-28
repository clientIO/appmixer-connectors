'use strict';

module.exports = {

    receive: async function(context) {

        const cacheKey = 'claude_models';
        const isSource = context.messages?.in?.content?.isSource;
        let lock;
        try {
            lock = await context.lock(cacheKey);

            // Return cached models if available and called as source
            if (isSource) {
                const modelsCached = await context.staticCache.get(cacheKey);
                if (modelsCached) {
                    return context.sendJson({ models: modelsCached }, 'out');
                }
            }

            const url = 'https://api.anthropic.com/v1/models?limit=1000';
            const { data } = await context.httpRequest({
                url,
                headers: {
                    'x-api-key': context.auth.apiKey,
                    'anthropic-version': '2023-06-01'
                }
            });

            // Cache the models for 1 hour unless specified otherwise in the config.
            if (isSource) {
                await context.staticCache.set(
                    cacheKey,
                    data.data,
                    context.config.listModelsCacheTTL || (60 * 60 * 1000)
                );
            }

            return context.sendJson({ models: data.data }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    toSelectOptions(out) {
        return out.models.map(model => {
            return { label: model.id, value: model.id };
        });
    }
};
