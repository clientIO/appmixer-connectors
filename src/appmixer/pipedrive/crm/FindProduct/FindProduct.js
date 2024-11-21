'use strict';

/**
 * FindProduct action.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let { term, exactMatch, limit } = context.messages.query.content;
        const queryParams = {
            term,
            exact_match: exactMatch,
            limit: limit ?? 100
        };

        context.log({ step: 'queryParams', queryParams });

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.pipedrive.com/v1/products/search',
            headers: {
                'x-api-token': `${context.auth.apiKey}`
            },
            params: queryParams
        });

        context.log({ step: 'API response', data });
        const responseData = data.data.items.map((item) => {
            return {
                ...item.item
            };
        });
        context.log({ step: 'responseData', responseData });

        return context.sendJson({ products: responseData }, 'out');
    }
};
