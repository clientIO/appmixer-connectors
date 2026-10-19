'use strict';

const lib = require('../lib');

// Schema for a single project item.
const schema = {
    project_id: { type: 'string', title: 'Project ID' },
    name: { type: 'string', title: 'Name' },
    company: { type: 'string', title: 'Company' }
};

module.exports = {

    async receive(context) {

        const { outputType = 'array', isSource } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Projects' });
        }

        // Not a source call - always hit the API and let errors reach the flow.
        if (!isSource) {
            const { data } = await lib.apiRequest(context, {
                method: 'GET',
                path: '/v1/projects'
            });
            return lib.sendArrayOutput({ context, records: (data && data.projects) || [], outputType });
        }

        // Source call: this component backs every Project dropdown, so opening an
        // inspector must not fan out into one live request per field. Cache per
        // host + key for a short TTL behind a lock, and stay quiet on failure so
        // setup-time auth errors do not surface as designer errors.
        const cacheKey = `deepgram_projects_${lib.getBaseUrl(context.auth, context)}_${context.auth.apiKey}`;
        let lock;

        try {
            lock = await context.lock(cacheKey);

            const cached = await context.staticCache.get(cacheKey);
            if (cached) {
                return context.sendJson({ result: cached }, 'out');
            }

            const { data } = await lib.apiRequest(context, {
                method: 'GET',
                path: '/v1/projects'
            });

            const records = (data && data.projects) || [];

            // Only the fields the selector needs, to keep the cache small.
            await context.staticCache.set(
                cacheKey,
                records.map(project => ({
                    project_id: project.project_id,
                    name: project.name
                })),
                context.config.listProjectsCacheTTL || (60 * 1000)
            );

            return context.sendJson({ result: records }, 'out');

        } catch (error) {
            // A dropdown cannot do anything useful with an error - render it empty.
            return context.sendJson({ result: [] }, 'out');
        } finally {
            lock?.unlock();
        }
    },

    // Used by the Project dropdown (source) on project-scoped components/triggers.
    toSelectArray({ result }) {
        return (result || []).map(project => ({
            label: project.name ? `${project.name} (${project.project_id})` : project.project_id,
            value: project.project_id
        }));
    }
};
