'use strict';
const lib = require('../../lib');

module.exports = {
    async receive(context) {
        const response = await lib.callEndpoint(context, '/search', {
            method: 'POST',
            data: {
                filter: {
                    value: 'page',
                    property: 'object'
                },
                page_size: 100
            }
        });

        const pages = response.data.results.map(page => {
            const titleProperty = page.properties?.title?.title || [];
            const title = titleProperty.length > 0 ? titleProperty[0].plain_text : 'Untitled';

            return {
                id: page.id,
                title: title,
                created_time: page.created_time,
                last_edited_time: page.last_edited_time
            };
        });

        await context.sendJson({ pages }, 'out');
    },

    pageToSelectArray({ pages }) {
        return pages.map(page => {
            return { label: page.title, value: page.id };
        });
    }
};
