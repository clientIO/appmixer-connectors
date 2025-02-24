'use strict';
const PAGE_SIZE = 500; // Number of items to retrieve per page

module.exports = {

    async receive(context) {

        const { query, limit } = context.messages.in.content;
        const { accessToken } = context.auth;
        const MAX_LIMIT = limit || 500;
        let sites = [];
        let nextLink = null;
        let totalSites = 0;
        do {
            const queryParams = {
                $top: Math.min(
                    PAGE_SIZE,
                    MAX_LIMIT - totalSites
                ),
                search: query ?? '*'
            };

            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://graph.microsoft.com/v1.0/sites',
                headers: {
                    'Authorization': 'Bearer ' + accessToken
                },
                params: queryParams
            });

            if (!data || !data.value) break;

            sites = sites.concat(data.value);
            nextLink = data['@odata.nextLink'];
            totalSites += data.value.length;
        } while (nextLink && totalSites < MAX_LIMIT);

        return await context.sendJson({ sites }, 'out');
    },

    sitesToSelectArray({ sites }) {

        return sites.map((site) => {
            return { label: site.name, value: site.id };
        });
    }
};
