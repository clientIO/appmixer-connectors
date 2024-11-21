'use strict';

/**
 * FindDeal action.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { term, personId, exactMatch, orgId, status, limit } = context.messages.query.content;

        const queryParams = {
            term,
            person_id: personId,
            status,
            exact_match: exactMatch,
            organization_id: orgId,
            limit: limit ?? 100
        };

        context.log({ step: 'queryParams', queryParams });

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://api.pipedrive.com/v1/deals/search',
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

        return context.sendJson({ deals: responseData }, 'out');
    }
};
