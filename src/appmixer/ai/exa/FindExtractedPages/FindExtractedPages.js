'use strict';

const lib = require('../lib');

// The output contract of one extracted page as returned by /contents. Exported as
// ITEM_SCHEMA because the out port is dynamic — see the note in FindSearchResults
// for why the offline tooling needs it.
//
// Shape sampled from the live API on 2026-09-04: id and url came back on every
// record and are the same value (Exa identifies a page by its canonical URL).
// `title` is not in `required` on purpose — a crawl that fails or returns a
// non-HTML document can yield a record without one, and the sample was too small
// to claim otherwise. `text`, `summary`, `highlights` and `subpages` only appear
// when the request asked for them.
const ITEM_SCHEMA = {
    type: 'object',
    required: ['id', 'url'],
    properties: {
        'id': { 'type': 'string', 'title': 'Result ID', 'example': 'https://exa.ai/about' },
        'title': { 'type': 'string', 'title': 'Title', 'example': 'About Exa' },
        'url': { 'type': 'string', 'title': 'URL', 'example': 'https://exa.ai/about' },
        'publishedDate': { 'type': 'string', 'title': 'Published Date', 'example': '2024-11-08T00:00:00.000Z' },
        'author': { 'type': 'string', 'title': 'Author', 'example': 'Jane Doe' },
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
        // Only populated when the Subpages input asks for them. Declared so the
        // designer can bind subpage fields instead of falling back to Raw Output.
        'subpages': {
            'type': 'array',
            'title': 'Subpages',
            'items': {
                'type': 'object',
                'properties': {
                    'id': { 'type': 'string', 'title': 'Subpage ID', 'example': 'https://exa.ai/pricing' },
                    'title': { 'type': 'string', 'title': 'Subpage Title', 'example': 'Exa pricing' },
                    'url': { 'type': 'string', 'title': 'Subpage URL', 'example': 'https://exa.ai/pricing' },
                    'author': { 'type': 'string', 'title': 'Subpage Author', 'example': 'Jane Doe' },
                    'text': { 'type': 'string', 'title': 'Subpage Text', 'example': 'Exa pricing starts at $0 per month.' }
                }
            },
            'example': [{ 'id': 'https://exa.ai/pricing', 'title': 'Exa pricing', 'url': 'https://exa.ai/pricing' }]
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
            urls,
            includeText,
            includeHighlights,
            summaryQuery,
            maxAgeHours,
            subpages,
            subpageTarget,
            outputType
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, { label: 'Pages' });
        }

        const urlList = lib.toList(urls);
        if (!urlList) {
            throw new context.CancelError('URLs are required!');
        }

        const data = { urls: urlList };

        // /contents returns metadata only unless at least one content option is
        // asked for, so default to the full text when the user picked nothing.
        const contents = lib.buildContentsOptions({
            includeText: includeText === undefined ? true : includeText,
            includeHighlights,
            summaryQuery
        });
        Object.assign(data, contents);

        // maxAgeHours accepts 0 (force a fresh crawl) and -1 (cache only), so it
        // must be tested against undefined rather than for truthiness.
        if (maxAgeHours !== undefined && maxAgeHours !== null && maxAgeHours !== '') {
            data.maxAgeHours = maxAgeHours;
        }
        if (subpages) {
            data.subpages = subpages;

            const targets = lib.toList(subpageTarget);
            if (targets) {
                data.subpageTarget = targets;
            }
        }

        const response = await lib.makeRequest({ context, path: '/contents', data });
        const results = (response && response.results) || [];

        if (results.length === 0) {
            return context.sendJson({ urls: urlList }, 'notFound');
        }

        return lib.sendArrayOutput({ context, records: results, outputType });
    }
};
