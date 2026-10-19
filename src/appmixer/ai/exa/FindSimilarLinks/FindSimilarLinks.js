'use strict';

const lib = require('../lib');

// The output contract of one similar-page result; /findSimilar returns the same
// shape as /search. Exported as ITEM_SCHEMA because the out port is dynamic — see
// the note in FindSearchResults for why the offline tooling needs it.
//
// Shape sampled from the live API on 2026-09-04 over 8 results from two seed URLs:
// id, title, url and score came back on every record — score is intrinsic to a
// similarity ranking, unlike plain search. `publishedDate` appeared on one of the
// eight, and the content fields only when the request asked for them.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'title', 'url', 'score'],
    properties: {
        'id': { 'type': 'string', 'title': 'Result ID', 'example': 'https://www.appmixer.com/features' },
        'title': { 'type': 'string', 'title': 'Title', 'example': 'Appmixer features' },
        'url': { 'type': 'string', 'title': 'URL', 'example': 'https://www.appmixer.com/features' },
        'publishedDate': { 'type': 'string', 'title': 'Published Date', 'example': '2024-11-08T00:00:00.000Z' },
        'author': { 'type': 'string', 'title': 'Author', 'example': 'Jane Doe' },
        'score': { 'type': 'number', 'title': 'Similarity Score', 'example': 0.86 },
        'image': { 'type': 'string', 'title': 'Image URL', 'example': 'https://www.appmixer.com/og-image.png' },
        'favicon': { 'type': 'string', 'title': 'Favicon URL', 'example': 'https://www.appmixer.com/favicon.ico' },
        'text': { 'type': 'string', 'title': 'Page Text', 'example': 'Appmixer is an embedded integration platform.' },
        'summary': { 'type': 'string', 'title': 'Summary', 'example': 'A page describing the product features.' },
        'highlights': {
            'type': 'array',
            'title': 'Highlights',
            'items': { 'type': 'string' },
            'example': ['Embed a fully white-labelled integration builder in your app.']
        },
        // Exa's knowledge-graph entities for the page, returned sporadically when page
        // content was requested. The `properties` payload is polymorphic by entity
        // type (company, person, ...), so only the two stable leaves are declared.
        'entities': {
            'type': 'array',
            'title': 'Entities',
            'items': {
                'type': 'object',
                'properties': {
                    'id': { 'type': 'string', 'title': 'Entity ID', 'example': 'https://exa.ai/library/organization/sh0mvs0mk8r' },
                    'type': { 'type': 'string', 'title': 'Entity Type', 'example': 'company' }
                }
            },
            'example': [{ 'id': 'https://exa.ai/library/organization/sh0mvs0mk8r', 'type': 'company' }]
        }
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const {
            url,
            numResults,
            excludeSourceDomain,
            category,
            includeDomains,
            excludeDomains,
            startPublishedDate,
            endPublishedDate,
            includeText,
            includeHighlights,
            summaryQuery,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Similar Links' });
        }

        if (!url) {
            throw new context.CancelError('URL is required!');
        }

        const data = { url };

        if (numResults) {
            data.numResults = numResults;
        }
        if (excludeSourceDomain) {
            data.excludeSourceDomain = true;
        }
        if (category) {
            data.category = category;
        }
        if (startPublishedDate) {
            data.startPublishedDate = String(startPublishedDate).slice(0, 10);
        }
        if (endPublishedDate) {
            data.endPublishedDate = String(endPublishedDate).slice(0, 10);
        }

        const include = lib.toList(includeDomains);
        if (include) {
            data.includeDomains = include;
        }
        const exclude = lib.toList(excludeDomains);
        if (exclude) {
            data.excludeDomains = exclude;
        }

        const contents = lib.buildContentsOptions({ includeText, includeHighlights, summaryQuery });
        if (contents) {
            data.contents = contents;
        }

        const response = await lib.makeRequest({ context, path: '/findSimilar', data });
        const results = (response && response.results) || [];

        if (results.length === 0) {
            return context.sendJson({ url }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: results, outputType });
    }
};
