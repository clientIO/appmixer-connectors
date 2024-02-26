'use strict';

const { makeRequest } = require('../../common');

module.exports = {

    async receive(context) {

        const requestData = {
            'limit': 50,
            'offset': 0
        };
        const { data: response } = await makeRequest({ context, options: { path: '/list/campaign' , data: requestData } });
        return context.sendJson(response.data , 'out');
    },

    /**
     * Generates an array of objects with 'label' and 'value' properties from the given 'campaigns' array.
     *
     * @param {Array} campaigns - An array of campaign objects.
     * @return {Array} An array of objects with 'label' and 'value' properties.
     */
    campaignsToSelectArray(campaigns) {

        return campaigns.map((campaign) => {
            return { label: campaign['title'], value: campaign['id'] };
        });
    }
};

