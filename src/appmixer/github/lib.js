'use strict';
const repoReg = /[^\/]+/g;

module.exports = {

    async apiRequest(context, action, {
        method = 'GET',
        body = {},
        params = {}
    } = {}) {

        const url = `https://api.github.com/${action}`;
        const options = {
            method,
            url,
            headers: {
                'accept': 'application/vnd.github+json',
                'X-GitHub-Api-Version': '2022-11-28',
                'Authorization': `Bearer ${context.accessToken || context.auth?.accessToken}`
            },
            data: body,
            params
        };

        return await context.httpRequest(options);
    },

    async apiRequestPaginated(context, action, {
        method = 'GET',
        body = {},
        params = {}
    } = {}) {

        let items = [];
        let page = 1;
        let hasNextPage = true;

        while (hasNextPage) {
            const { data, headers } = await this.apiRequest(context, action, {
                method,
                body,
                params: {
                    ...params,
                    per_page: 100,
                    page
                }
            });

            items = items.concat(data);

            const linkHeader = headers.link;
            if (linkHeader) {
                const links = linkHeader.split(',').map(link => link.trim());
                const nextLink = links.find(link => link.includes('rel="next"'));
                hasNextPage = !!nextLink;
            } else {
                hasNextPage = false;
            }

            page++;
        }

        return items;
    },

    /**
     * Process items to find newly added.
     * @param knowItems
     * @param {Set} actualItems
     * @param {String} key
     */
    getNewItems(knowItems, actualItems, key) {

        const newItems = new Set();
        const actual = new Set();

        actualItems.forEach(item => {
            if (knowItems && !knowItems.has(item[key])) {
                newItems.add(item);
            }
            actual.add(item[key]);
        });

        return { diff: Array.from(newItems), actual: Array.from(actual) };
    }
};
