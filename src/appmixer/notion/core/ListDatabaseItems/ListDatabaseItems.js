'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const { databaseId } = context.messages.in.content;
        const endpoint = `/databases/${databaseId}/query`;

        // Fetching the pages from the selected database
        const response = await lib.callEndpoint(context, endpoint, {
            method: 'POST',
            data: {
                page_size: 100
            }
        });

        const pages = response.data.results.map(page => {
            // Look for the property whose type is 'title'
            const titleProperty = Object.values(page.properties).find(prop => prop.type === 'title');

            const pageTitle = titleProperty?.title?.[0]?.text?.content || 'Untitled';
            return {
                pageTitle,
                pageId: page.id
            };
        });

        return context.sendJson({ pages }, 'out');
    },

    pagesToSelectArray({ pages }) {
        return pages.map(page => ({
            label: page.pageTitle,
            value: page.pageId
        }));
    }
};
