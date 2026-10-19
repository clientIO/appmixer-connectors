'use strict';

const lib = require('../../lib');

// Appmixer components do not expose limit/offset pagination controls; a fixed
// result count balances usefulness against the per-result credit cost.
const SEARCH_LIMIT = 20;

const schema = {
    'title': { 'type': 'string', 'title': 'Title' },
    'description': { 'type': 'string', 'title': 'Description' },
    'url': { 'type': 'string', 'title': 'URL' },
    'imageUrl': { 'type': 'string', 'title': 'Image URL' }
};

module.exports = {

    async receive(context) {

        const {
            query,
            source,
            includeDomains,
            excludeDomains,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Search Results' });
        }

        if (!query) {
            throw new context.CancelError('Query is required!');
        }

        const searchSource = source || 'web';

        const payload = {
            query,
            limit: SEARCH_LIMIT,
            sources: [{ type: searchSource }]
        };

        const include = lib.parseList(includeDomains);
        const exclude = lib.parseList(excludeDomains);
        if (include.length && exclude.length) {
            throw new context.CancelError('Include Domains and Exclude Domains cannot be combined.');
        }
        if (include.length) {
            payload.includeDomains = include;
        }
        if (exclude.length) {
            payload.excludeDomains = exclude;
        }

        const response = await lib.makeRequest({
            context,
            method: 'POST',
            path: '/v2/search',
            data: payload
        });

        const items = (response && response.data && response.data[searchSource]) || [];

        const records = items.map(item => ({
            title: item.title,
            description: item.description,
            url: item.url,
            imageUrl: item.imageUrl
        }));

        if (records.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, records, outputType });
    }
};
