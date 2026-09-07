'use strict';

const lib = require('../../lib');

// Shared by tick() and test() — single source of truth for the request shape.
const requestAnnotations = async (context, projectId, params = {}) => {
    const { data } = await lib.apiCall(context, {
        url: `/api/projects/${projectId}/annotations/`,
        params
    });
    return data.results || [];
};

module.exports = {

    async tick(context) {

        const { projectId } = context.properties;
        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }

        const annotations = await requestAnnotations(context, projectId, { limit: 100 });

        const known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        const { diff, actual } = lib.getNewItems(known, annotations, 'id');

        for (const annotation of diff) {
            await context.sendJson(annotation, 'out');
        }

        await context.saveState({ known: actual });
    },

    async test(context) {

        const { projectId } = context.properties;
        if (!projectId) {
            throw new context.CancelError('Project is required!');
        }

        const annotations = await requestAnnotations(context, projectId, { limit: 1 });
        if (!annotations.length) {
            throw new context.CancelError(
                'No annotations found in the project to use as test data. Create an annotation in PostHog first.'
            );
        }

        return context.sendJson(annotations[0], 'out');
    }
};
