'use strict';

const lib = require('../../lib');

// Schema of a single parsed organic SERP result. Shared by the live path and the
// generateOutputPortOptions path so the designer always shows what is sent.
const schema = {
    'rank': { 'type': 'integer', 'title': 'Rank', 'example': 1 },
    'title': { 'type': 'string', 'title': 'Title', 'example': 'Bright Data - The World\'s #1 Web Data Platform' },
    'link': { 'type': 'string', 'title': 'Link', 'example': 'https://brightdata.com/' },
    'display_link': { 'type': 'string', 'title': 'Display Link', 'example': 'https://brightdata.com' },
    // eslint-disable-next-line max-len
    'description': { 'type': 'string', 'title': 'Description', 'example': 'Bright Data provides proxy networks and web scraping tools.' },
    'global_rank': { 'type': 'integer', 'title': 'Global Rank', 'example': 1 }
};

module.exports = {

    async receive(context) {

        const {
            zone,
            query,
            engine,
            country,
            language,
            numResults,
            page,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Results' });
        }

        if (!zone) {
            throw new context.CancelError('Zone is required!');
        }
        if (!query) {
            throw new context.CancelError('Query is required!');
        }

        const searchUrl = lib.buildSearchUrl({
            context,
            engine: engine || 'google',
            query,
            country: country ? String(country).toLowerCase() : undefined,
            language,
            numResults,
            page
        });

        const response = await lib.zoneRequest({ context, zone, url: searchUrl });

        // With `brd_json=1` the SERP arrives as a JSON document, but `format: raw`
        // means it is delivered as a plain body, so it can reach us as a string.
        const parsed = lib.parseMaybeJson(response.data);
        const results = (parsed && Array.isArray(parsed.organic)) ? parsed.organic : [];

        if (results.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: results, outputType });
    }
};
