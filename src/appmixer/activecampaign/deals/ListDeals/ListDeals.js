'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const { trimUndefined } = require('../../helpers');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const {
            filter,
            limit,
            search,
            stage,
            status
        } = context.messages.in.content;

        const ac = new ActiveCampaign(auth.url, auth.apiKey);

        let params = {};

        if (filter) {
            if (search) {
                params['filters[search]'] = search;
                params['filters[search_field]'] = 'all';
            }
            params['filters[status]'] = status;
            params['filters[stage]'] = stage;

            params = trimUndefined(params);
        }

        const deals = await ac.getDeals(params, limit);
        return context.sendJson({ deals }, 'deals');
    },

    dealsToSelectArray({ deals }) {

        return deals.map(deal => {
            return { label: deal.title, value: deal.id };
        });
    }
};
