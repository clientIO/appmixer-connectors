'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);
        const { data } = await ac.call('get', 'dealTasktypes');
        return context.sendJson({ data }, 'out');
    },

    dealTaskTypesToSelectArray({ data }) {

        const { dealTasktypes = [] } = data;
        return dealTasktypes.map(type => {
            return { label: `${type.title}`, value: type.id };
        });
    }
};
