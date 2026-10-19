'use strict';
const commons = require('./lib');

// Refresh this long before Shopify's own expiry so a call that starts just before
// the deadline does not go out with a token that expires in flight.
const EXPIRY_MARGIN_MS = 5 * 60 * 1000;

const tokenUrl = context => `https://${commons.normalizeStore(context.store)}.myshopify.com/admin/oauth/access_token`;

const SHOP_PROFILE = `query ShopProfile {
    shop { id name email myshopifyDomain currencyCode ianaTimezone plan { publicDisplayName } }
}`;

// Shopify answers a token request either with an expiring offline token
// ({ access_token, expires_in, refresh_token }) or, for apps that are still
// allowed non-expiring tokens, with { access_token } alone.
const toTokens = (data, context) => {

    const tokens = {
        accessToken: data.access_token,
        refreshToken: data.refresh_token || context.refreshToken || null
    };
    if (data.expires_in) {
        tokens.accessTokenExpDate = new Date(Date.now() + data.expires_in * 1000 - EXPIRY_MARGIN_MS);
    }
    return tokens;
};

const requestTokens = async (context, params) => {

    const { data } = await context.httpRequest({
        method: 'POST',
        url: tokenUrl(context),
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        },
        data: new URLSearchParams({
            'client_id': context.clientId,
            'client_secret': context.clientSecret,
            ...params
        }).toString()
    });

    return toTokens(data, context);
};

module.exports = {

    type: 'oauth2',

    definition: {

        // Scopes are requested all at once and not split into components: Shopify
        // keeps a single current offline token per app and store, so a second
        // consent for more scopes would retire the refresh token of the first one.
        scope: [
            'read_customers',
            'write_customers',
            'read_products',
            'write_products',
            'read_orders',
            'write_orders',
            'read_draft_orders',
            'read_fulfillments',
            'read_inventory',
            'read_locations',
            'read_reports',
            'read_returns',
            'read_discounts',
            'write_discounts',
            'read_publications',
            'write_publications'
        ],

        accountNameFromProfileInfo: context => {

            return context.profileInfo.name;
        },

        pre: {
            store: {
                type: 'text',
                name: 'Store Address',
                tooltip: 'Enter your Shopify store address (without <b>.myshopify.com</b>).',
                required: true
            }
        },

        authUrl: context => {

            return 'https://{{store}}.myshopify.com/admin/oauth/authorize?' +
                `client_id=${encodeURIComponent(context.clientId)}&` +
                `redirect_uri=${encodeURIComponent(context.callbackUrl)}&` +
                `state=${encodeURIComponent(context.ticket)}&scope=${encodeURIComponent(context.scope.join(','))}`;
        },

        // `expiring=1` asks for an expiring offline token (1 hour) with a refresh
        // token (90 days). Shopify requires it of public apps created since April
        // 2026 and of every public app from January 2027.
        requestAccessToken: context => {

            return requestTokens(context, { code: context.authorizationCode, expiring: '1' });
        },

        // Every refresh rotates the refresh token, so the new one has to be stored.
        refreshAccessToken: async context => {

            if (!context.refreshToken) {
                throw new context.InvalidTokenError('The Shopify access token is no longer valid. Reconnect the account.');
            }

            try {
                return await requestTokens(context, {
                    'grant_type': 'refresh_token',
                    'refresh_token': context.refreshToken
                });
            } catch (err) {
                // Shopify answers 401 once a refresh token is retired or expired;
                // retrying cannot help, the merchant has to authorize again.
                if (err.response && err.response.status === 401) {
                    throw new context.InvalidTokenError('The Shopify refresh token is no longer valid. Reconnect the account.');
                }
                throw err;
            }
        },

        // `name` is the account name (accountNameFromProfileInfo).
        requestProfileInfo: async context => {

            const { shop } = await commons.graphql(context, SHOP_PROFILE);
            return shop;
        },

        validateAccessToken: async context => {

            try {
                await commons.graphql(context, SHOP_PROFILE);
            } catch (err) {
                if (err.statusCode === 401 || err.statusCode === 402 || err.statusCode === 403) {
                    throw new context.InvalidTokenError(err.statusMessage || 'Invalid Shopify access token.');
                }
                throw err;
            }
        }
    }
};
