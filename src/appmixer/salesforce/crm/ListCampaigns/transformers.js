'use strict';

/**
 * Transformer for campaigns in salesforce
 * @param {Object|string} campaigns
 */
module.exports.campaignsToSelectArray = out => {

    // The dropdown source call runs ListCampaigns with the default 'array'
    // outputType, which wraps the records as { result: [...] }.
    const campaigns = Array.isArray(out) ? out : (out && out.result);
    let transformed = [];

    if (Array.isArray(campaigns)) {
        campaigns.forEach(campaign => {

            transformed.push({
                label: campaign['Name'],
                value: campaign['Id']
            });
        });
    }

    return transformed;
};
