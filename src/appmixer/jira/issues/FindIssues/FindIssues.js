'use strict';
const commons = require('../../jira-commons');
const lib = require('../../lib.outputPortOptions');

/**
 * Enhanced JQL search component using the new /rest/api/3/search/jql endpoint
 * Supports advanced field selection, expansion options, and up to 5000 results
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { profileInfo: { apiUrl }, auth } = context;
        const {
            query,
            maxResults = 50,
            fields = '*navigable',
            properties,
            fieldsByKeys = false,
            failFast = false,
            outputType = 'array'
        } = context.messages.in.content;

        // Validate required parameters
        if (!query || !query.trim()) {
            throw new context.CancelError('JQL query is required!');
        }

        // Build query parameters
        const params = {
            jql: query.trim(),
            maxResults: Math.min(maxResults, 5000), // Enforce API limit
            fields: fields.trim()
        };

        // Add optional parameters only if they have values
        if (properties && properties.trim()) {
            // Limit to 5 properties as per API spec
            const propList = properties.split(',').map(p => p.trim()).filter(p => p);
            if (propList.length > 5) {
                throw new context.CancelError('Maximum 5 issue properties are allowed');
            }
            params.properties = propList.join(',');
        }

        if (fieldsByKeys) {
            params.fieldsByKeys = true;
        }

        if (failFast) {
            params.failFast = true;
        }

        // Execute the search
        const found = await commons.get(`${apiUrl}search/jql`, auth, params);

        const issues = found?.issues || [];

        if (issues.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        return lib.sendArrayOutput({
            context,
            outputPortName: 'issue',
            records: issues,
            outputType,
            arrayPropertyValue: 'issues'
        });
    }
};
