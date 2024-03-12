'use strict';
const ShopifyToken = require('shopify-token');
const commons = require('./shopify-commons');

module.exports = {

    type: 'oauth2',

    definition: {

        // we can't split the scopes into components, see related issue: https://github.com/clientIO/appmixer-core/issues/2040
        // List of all scopes: https://shopify.dev/docs/api/usage/access-scopes
        scope: [
            'read_customers',
            'write_customers',
            'read_products',
            'write_products',
            'read_orders',
            'write_orders',
            'read_reports',
            'write_reports',
            'read_inventory',
            'write_inventory'
        ],

        accountNameFromProfileInfo: context => {

            return context.profileInfo.name;
        },

        pre: {
            store: {
                type: 'text',
                name: 'Store Address',
                tooltip: 'Enter your Shopify store address (without .myshopify.com)',
                required: true
            }
        },

        authUrl: context => {

            return 'https://{{store}}.myshopify.com/admin/oauth/authorize?' +
                `client_id=${encodeURIComponent(context.clientId)}&` +
                `redirect_uri=${encodeURIComponent(context.callbackUrl)}&` +
                `state=${encodeURIComponent(context.ticket)}&scope=${encodeURIComponent(context.scope.join(','))}`;
        },

        requestAccessToken: async context => {

            const shopifyToken = new ShopifyToken({
                redirectUri: context.callbackUrl,
                apiKey: context.clientId,
                sharedSecret: context.clientSecret,
                scopes: context.scope.join(',')
            });

            const storeAddress = `${context.store}.myshopify.com`;
            const response = await shopifyToken.getAccessToken(storeAddress, context.authorizationCode);
            return {
                accessToken: response['access_token'],
                refreshToken: null
            };
        },

        requestProfileInfo: context => {

            const shopify = commons.getShopifyAPI(context);

            return shopify.shop.get();
        },

        validateAccessToken: async context => {

            const shopify = commons.getShopifyAPI(context);

            try {
                await shopify.shop.get();
            } catch (err) {
                if (err.statusCode === 402) {
                    throw new context.InvalidTokenError(err.statusMessage);
                }
                throw err;
            }
        }
    }
};
