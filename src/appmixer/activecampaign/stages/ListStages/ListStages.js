'use strict';
const ActiveCampaign = require('../../ActiveCampaign');

module.exports = {

    async receive(context) {

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey);
        const { data } = await ac.call('get', 'dealStages');
        return context.sendJson({ data }, 'out');
    },

    dealStagesToSelectArray({ data }) {

        const { dealStages = [] } = data;
        return dealStages.map(stage => {
            return { label: stage.title, value: stage.id };
        });
    }
};
