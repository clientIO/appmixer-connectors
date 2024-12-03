'use strict';

const { baseUrl } = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await context.httpRequest({
            headers: {
                'x-API-Id': context.auth.id,
                'x-API-Key': context.auth.key
            },
            url: `${baseUrl}/v1/sites/list`,
            method: 'POST' // v1 API uses POST for all requests
        });

        return context.sendJson({ items: data?.sites }, 'out');
    },

    toSelectArray({ items }) {

        return items.map(site => {
            return { label: site.domain, value: site.site_id };
        });
    }
};
