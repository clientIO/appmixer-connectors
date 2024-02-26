'use strict';
const { makeRequest } = require('../common');

const PAGE_SIZE = 50; // Number of items to retrieve per page

module.exports = {

    async receive(context) {

        const { limit } = context.messages.in.content;
        const MAX_LIMIT = limit || 100;
        let sites = [];
        let nextLink = null;
        let totalSites = 0;
        do {
            const result = await makeRequest(
                {
                    url:
                        nextLink ||
                        `https://graph.microsoft.com/v1.0/sites?$top=${Math.min(
                            PAGE_SIZE,
                            MAX_LIMIT - totalSites
                        )}&search=`,
                    method: 'GET',
                    body: null
                },
                context
            );
            sites = sites.concat(result.value);
            nextLink = result['@odata.nextLink'];
            totalSites += result.value.length;
        } while (nextLink && totalSites < MAX_LIMIT);
        return context.sendJson({ sites }, 'out');
    },

    sitesToSelectArray({ sites }) {

        return sites.map((site) => {
            return { label: site.name, value: site.id };
        });
    }
};
