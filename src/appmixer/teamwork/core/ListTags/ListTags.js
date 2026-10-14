'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { searchTerm } = context.messages.in.content;
        let q = {}
        if (searchTerm !== null && searchTerm !== undefined) {
            q.searchTerm = searchTerm;
        }

        let allTags = [];
        let page = 1;
        let pageSize = 500;
        let hasMore = true;
        try {
            while (hasMore) {
                q.page = page;
                q.pageSize = pageSize;

                let resp = await lib.callAPI(
                    context,
                    "GET",
                    '/projects/api/v3/tags.json',
                    null,
                    q
                );

                if (resp && Array.isArray(resp.tags)) {
                    allTags = allTags.concat(resp.tags);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching tags: ${error.message}`);
        }

        return context.sendJson({ tags: allTags }, 'tags');
    },

    toInspector: function(data){
        let transformed = [];
        if (data && Array.isArray(data.tags)) {
            data.tags.forEach(tag => {
                transformed.push({
                    label: tag.name,
                    value: tag.id.toString()
                });
            });
        }

        return transformed;
    }
}
