'use strict';
const lib = require('../../lib');

const fetchItems = async (context, databaseId) => {
    // Fetching the pages from the selected database
    const response = await lib.callEndpoint(context, `/databases/${databaseId}/query`, {
        method: 'POST',
        data: {
            page_size: 100
        }
    });

    return response.data.results.map(page => {
        // Look for the property whose type is 'title'
        const titleProperty = Object.values(page.properties).find(prop => prop.type === 'title');

        const pageTitle = titleProperty?.title?.[0]?.text?.content || 'Untitled';
        return {
            pageTitle,
            pageId: page.id
        };
    });
};

module.exports = {
    // Private: only ever called as the source of a database-item dropdown. Cached,
    // and a missing database or a failure renders an empty dropdown rather than an
    // error — the input is a typeahead, so the ID can still be typed in.
    async receive(context) {
        const { databaseId } = context.messages.in?.content || {};

        if (!databaseId) {
            return context.sendJson({ pages: [] }, 'out');
        }

        try {
            const pages = await lib.withCache(
                context,
                ['ListDatabaseItems', databaseId],
                () => fetchItems(context, databaseId)
            );
            return context.sendJson({ pages }, 'out');
        } catch (err) {
            return context.sendJson({ pages: [] }, 'out');
        }
    },

    pagesToSelectArray({ pages }) {
        return pages.map(page => ({
            label: page.pageTitle,
            value: page.pageId
        }));
    }
};
