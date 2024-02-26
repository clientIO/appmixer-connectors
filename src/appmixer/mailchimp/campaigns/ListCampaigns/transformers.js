'use strict';

/**
 * @param {Array} campaigns
 */
module.exports.campaignsToSelectArray = campaigns => {

    let transformed = [];

    if (Array.isArray(campaigns)) {
        campaigns.forEach(campaign => {
            transformed.push({
                label: campaign['settings']['title'],
                value: campaign.id
            });
        });
    }

    return transformed;
};
