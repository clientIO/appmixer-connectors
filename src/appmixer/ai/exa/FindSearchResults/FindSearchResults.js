'use strict';

const lib = require('../lib');

// The output contract of one Exa search result. A dynamic (source) output port has
// no `schema` in component.json — the designer builds the variable picker from the
// options this component emits under `generateOutputPortOptions`. Exporting it as
// ITEM_SCHEMA gives the offline tooling the same contract the static ports declare,
// and gives `required` somewhere to live so `appmixer connector verify` does not
// treat every field as mandatory.
//
// Shape sampled from the live API on 2026-09-04 over 15 results across three query
// shapes: only id, title and url came back on every record. `author` and
// `publishedDate` are present on roughly half — Exa omits them when the page does
// not expose them. `score` is only returned by the ranking search types, and
// `text`, `summary` and `highlights` only when the request asked for that content.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'title', 'url'],
    properties: {
        'id': { 'type': 'string', 'title': 'Result ID', 'example': 'https://exa.ai/about' },
        'title': { 'type': 'string', 'title': 'Title', 'example': 'About Exa' },
        'url': { 'type': 'string', 'title': 'URL', 'example': 'https://exa.ai/about' },
        'publishedDate': { 'type': 'string', 'title': 'Published Date', 'example': '2024-11-08T00:00:00.000Z' },
        'author': { 'type': 'string', 'title': 'Author', 'example': 'Jane Doe' },
        'score': { 'type': 'number', 'title': 'Relevance Score', 'example': 0.86 },
        'image': { 'type': 'string', 'title': 'Image URL', 'example': 'https://exa.ai/og-image.png' },
        'favicon': { 'type': 'string', 'title': 'Favicon URL', 'example': 'https://exa.ai/favicon.ico' },
        'text': { 'type': 'string', 'title': 'Page Text', 'example': 'Exa is a search engine built for AI.' },
        'summary': { 'type': 'string', 'title': 'Summary', 'example': 'Exa sells a web search API for AI agents.' },
        'highlights': {
            'type': 'array',
            'title': 'Highlights',
            'items': { 'type': 'string' },
            'example': ['Exa is a search engine built for AI applications.']
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
            query,
            searchType,
            numResults,
            category,
            includeDomains,
            excludeDomains,
            startPublishedDate,
            endPublishedDate,
            userLocation,
            includeText,
            includeHighlights,
            summaryQuery,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Results' });
        }

        if (!query) {
            throw new context.CancelError('Query is required!');
        }

        const data = {
            query,
            type: searchType || 'auto'
        };

        if (numResults) {
            data.numResults = numResults;
        }
        if (category) {
            data.category = category;
        }
        if (userLocation) {
            data.userLocation = userLocation;
        }
        // The date picker can hand us a full ISO timestamp; the API accepts ISO
        // 8601 but the date-only form is what the inspector actually collects.
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

        const response = await lib.makeRequest({ context, path: '/search', data });
        const results = (response && response.results) || [];

        if (results.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: results, outputType });
    }
};
