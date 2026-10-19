'use strict';

const lib = require('../lib');

// How many result ids to remember between ticks. Exa can return up to 100
// results per poll, so this keeps roughly the last ten polls' worth of pages in
// state without letting it grow without bound.
const MAX_KNOWN_IDS = 1000;

/**
 * The single request + mapping path. tick() and test() both go through this so
 * the object emitted in Test Mode is identical to the one production emits.
 * @param {object} context Appmixer component context
 * @returns {Promise<array>} the search results, newest first as Exa ranked them
 */
async function search(context) {

    const {
        query,
        searchType,
        numResults,
        category,
        includeDomains,
        excludeDomains,
        includeText
    } = context.properties;

    const data = {
        query,
        type: searchType || 'fast'
    };

    if (numResults) {
        data.numResults = numResults;
    }
    if (category) {
        data.category = category;
    }

    const include = lib.toList(includeDomains);
    if (include) {
        data.includeDomains = include;
    }
    const exclude = lib.toList(excludeDomains);
    if (exclude) {
        data.excludeDomains = exclude;
    }

    const contents = lib.buildContentsOptions({ includeText });
    if (contents) {
        data.contents = contents;
    }

    const response = await lib.makeRequest({ context, path: '/search', data });
    return (response && response.results) || [];
}

/**
 * Exa identifies a result by `id`, which is the canonical URL. Fall back to the
 * url field so a result without an id still dedupes correctly.
 * @param {object} result a single Exa search result
 * @returns {string}
 */
function resultId(result) {
    return result.id || result.url;
}

module.exports = {

    async tick(context) {

        const { query } = context.properties;

        if (!query) {
            throw new context.CancelError('Query is required!');
        }

        const results = await search(context);
        const currentIds = results.map(resultId).filter(Boolean);

        // First run: record what is already out there and emit nothing, otherwise
        // turning the flow on would fire once per existing page.
        if (!Array.isArray(context.state.known)) {
            return context.saveState({ known: currentIds.slice(0, MAX_KNOWN_IDS) });
        }

        const known = new Set(context.state.known);
        const fresh = results.filter(result => {
            const id = resultId(result);
            return id && !known.has(id);
        });

        for (const result of fresh) {
            await context.sendJson(result, 'out');
        }

        // Keep the newly seen ids at the front so the oldest fall off the window.
        const merged = [...currentIds, ...context.state.known];
        const deduped = [...new Set(merged)].slice(0, MAX_KNOWN_IDS);

        return context.saveState({ known: deduped });
    },

    async test(context) {

        // Test Mode runs with empty state, so this deliberately skips the dedup
        // and baseline logic and just emits the single best current match for the
        // configured query — the same object shape tick() sends.
        const results = await search(context);

        if (!results.length) {
            throw new Error(`Exa returned no results for "${context.properties.query}", so there is no example to show.`);
        }

        return context.sendJson(results[0], 'out');
    }
};
