'use strict';

const lib = require('../../lib');

// Schema of a single search result.
const schema = {
    'title': { 'type': 'string', 'title': 'Title', 'example': 'Welcome to Tavily' },
    'url': { 'type': 'string', 'title': 'URL', 'example': 'https://docs.tavily.com/welcome' },
    'content': {
        'type': 'string',
        'title': 'Content',
        'example': 'Tavily is a search engine built for AI agents, returning ranked snippets ...'
    },
    'score': { 'type': 'number', 'title': 'Relevance Score', 'example': 0.9137 },
    'published_date': { 'type': 'string', 'title': 'Published Date', 'example': 'Mon, 14 Jul 2025 08:00:00 GMT' },
    'raw_content': {
        'type': 'string',
        'title': 'Raw Content',
        'example': '# Welcome to Tavily\n\nTavily is a search engine built for AI agents ...'
    },
    'favicon': { 'type': 'string', 'title': 'Favicon', 'example': 'https://docs.tavily.com/favicon.ico' }
};

module.exports = {
    async receive(context) {

        const {
            query,
            searchDepth,
            topic,
            maxResults,
            timeRange,
            startDate,
            endDate,
            includeDomains,
            excludeDomains,
            includeRawContent,
            includeFavicon,
            country,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Results' });
        }

        if (!query) {
            throw new context.CancelError('Query is required!');
        }

        const data = {
            query,
            search_depth: searchDepth || 'basic',
            topic: topic || 'general'
        };

        if (maxResults) {
            data.max_results = maxResults;
        }
        if (timeRange) {
            data.time_range = timeRange;
        }
        // The date picker can hand us a full ISO timestamp, but the API only
        // accepts YYYY-MM-DD.
        if (startDate) {
            data.start_date = String(startDate).slice(0, 10);
        }
        if (endDate) {
            data.end_date = String(endDate).slice(0, 10);
        }
        if (includeRawContent) {
            data.include_raw_content = includeRawContent;
        }
        if (includeFavicon) {
            data.include_favicon = true;
        }
        if (country) {
            data.country = country;
        }

        const include = lib.toList(includeDomains);
        if (include) {
            data.include_domains = include;
        }
        const exclude = lib.toList(excludeDomains);
        if (exclude) {
            data.exclude_domains = exclude;
        }

        const response = await lib.makeRequest({ context, path: '/search', data });
        const results = (response && response.results) || [];

        if (results.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: results, outputType });
    }
};
