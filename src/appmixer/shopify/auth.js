'use strict';
const commons = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            store: {
                type: 'text',
                name: 'Store Address',
                tooltip: 'Enter your Shopify store address (without <b>.myshopify.com</b>).',
                required: true
            },
            accessToken: {
                type: 'text',
                name: 'Admin API access token',
                tooltip: 'Create a custom app in your Shopify admin ' +
                    '(<i>Settings &rarr; Apps and sales channels &rarr; Develop apps</i>), enable the required ' +
                    'scopes (customers, products, orders, draft orders, fulfillments, inventory, locations, ' +
                    'reports, returns) and generate an Admin API access token ' +
                    '(starts with <b>shpat_</b>). The token is shown only once, so copy it immediately.',
                required: true
            }
        },

        accountNameFromProfileInfo: context => {

            return context.profileInfo.name;
        },

        requestProfileInfo: context => {

            const shopify = commons.getShopifyAPI(context);

            return shopify.shop.get();
        },

        // Custom app Admin API access tokens do not expire, so no refresh logic is needed.
        validate: async context => {

            const shopify = commons.getShopifyAPI(context);

            try {
                await shopify.shop.get();
            } catch (err) {
                if (err.statusCode === 401 || err.statusCode === 402 || err.statusCode === 403) {
                    throw new context.InvalidTokenError(err.statusMessage || 'Invalid Admin API access token.');
                }
                throw err;
            }

            return true;
        }
    }
};
