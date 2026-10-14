'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function (context) {
        let {
            searchTerm,
            workflow,
            workflowId,
        } = context.messages.in.content;
        // Workflow ID: from direct workflowId, or from workflow select (value = id)
        const id = workflowId ?? workflow?.workflowId ?? workflow?.value;
        // When used as source (e.g. in trigger), workflow may be unselected ("any" or empty) on initial render - return empty stages
        if (id == null || id === '' || id === 'any') {
            return context.sendJson({ workflowStages: [] }, 'workflowStages');
        }
        const resolvedWorkflowId = typeof id === 'string' ? id : String(id);

        let q = {};
        q.searchTerm = searchTerm;

        let allWorkflowStages = [];
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
                    `/projects/api/v3/workflows/${resolvedWorkflowId}/stages.json`,
                    null,
                    q
                );

                if (resp && Array.isArray(resp.stages)) {
                    allWorkflowStages = allWorkflowStages.concat(resp.stages);
                } else {
                    throw new Error('Invalid API response structure');
                }

                hasMore = resp.meta?.page?.hasMore || false;
                page++;
            }
        } catch (error) {
            throw new Error(`Error fetching workflow stages: ${error.message}`);
        }

        return context.sendJson({ workflowStages: allWorkflowStages }, 'workflowStages');
    },

    toInspector: function (data) {
        let transformed = [
            {
                label: "Any",
                value: "any"
            },
            {
                label: "Backlog",
                value: '0',
            },
        ];
        const stages = data?.workflowStages ?? data?.stages;
        if (stages && Array.isArray(stages)) {
            stages.forEach(stage => {
                transformed.push({
                    label: stage.name,
                    value: stage.id.toString()
                });
            });
        }

        return transformed;
    }
}
