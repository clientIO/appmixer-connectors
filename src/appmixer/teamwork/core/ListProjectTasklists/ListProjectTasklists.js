'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {
        let { searchTerm } = context.messages.in.content;
        let q = {}
        if (searchTerm !== null && searchTerm !== undefined) {
            q.searchTerm = searchTerm;
        }

        let { projectId } = context.messages.in.content;
        let allTasklists = [];
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
                    `/projects/api/v3/projects/${projectId}/tasklists.json`,
                    null,
                    q
                );

                if (resp && Array.isArray(resp.tasklists)) {
                    allTasklists = allTasklists.concat(resp.tasklists);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching tasklists: ${error.message}`);
        }

        return context.sendJson({ tasklists: allTasklists }, 'tasklists');
    },

    toInspector: function(data){
        let transformed = [];

        if (data && Array.isArray(data.tasklists)) {
            data.tasklists.forEach(tasklist => {
                transformed.push({
                    label: tasklist.name,
                    value: tasklist.id.toString()
                });
            });
        }

        return transformed;
    }

}
