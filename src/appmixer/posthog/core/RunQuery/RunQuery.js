'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { projectId, query } = context.messages.in.content;

        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }
        if (!query) {
            throw new context.CancelError('HogQL Query is required!');
        }

        const { data } = await lib.apiCall(context, {
            method: 'POST',
            url: `/api/projects/${projectId}/query/`,
            data: {
                query: {
                    kind: 'HogQLQuery',
                    query
                }
            }
        });

        const results = data.results || [];
        return context.sendJson({
            results,
            columns: data.columns || [],
            count: results.length
        }, 'out');
    }
};
