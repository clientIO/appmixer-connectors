'use strict';
const ZohoClient = require('./ZohoClient');
const { trustedAccountsServer, trustedApiDomain } = require('./endpoints');
const {
    exchangeAuthorizationCode,
    findApiDataCenter,
    refreshToken,
    accessTokenExpDate
} = require('./oauth');

/**
 * Validate user - get user info. The data center is taken from context.profileInfo, or from the
 * account being connected (dataCenter) when there is no profileInfo yet.
 * @param {*} context
 * @return {Promise<*|null>}
 */
const validateUser = async (context) => {

    const zc = new ZohoClient(context, dataCenter);
    const { users } = await zc.request('GET', '/crm/v2/users', {
        params: { type: 'CurrentUser' }
    });

    return Array.isArray(users) ? users.pop() : null;
};

/**
 * Different accounts live in different data centers - us | eu | in | au | cn | jp | ca | sa | uk | ae | sg.
 * The data center is saved into account.profileInfo (region, accountsServer, apiDomain) for later
 * API requests and token refreshes.
 *
 * During the OAuth flow it is found by asking Zoho, not remembered: with the Auth Hub the redirect
 * callback, the code exchange and the profile request are separate requests that may run in
 * different processes, and only the code and the scope travel between them. What the redirect
 * callback named (`location`, `accounts-server`) is kept here only as a hint of which data center
 * to try first - it is missing in another process and may belong to another account being connected
 * at the same time.
 */
let dataCenter = {};

/**
 * Data center to try first: the one this process saw during the OAuth flow, else the account's.
 * @param {*} context
 * @returns {Object}
 */
const dataCenterHint = context => {

    return (dataCenter.accountsServer || dataCenter.region) ? dataCenter : (context.profileInfo || {});
};

module.exports = {

    type: 'oauth2',

    definition: {

        scope: [
            'ZohoCRM.modules.ALL',
            'ZohoCRM.users.ALL',
            'ZohoCRM.settings.fields.READ',
            'ZohoCRM.notifications.ALL'
        ],

        scopeDelimiter: ',',

        // Zoho issues a refresh token only on the user's first consent to the client. Without
        // prompt=consent, reconnecting an account (or connecting a second one for the same Zoho
        // user) yields an access token only, and the account stops working after an hour.
        authUrl: 'https://accounts.zoho.com/oauth/v2/auth?access_type=offline&prompt=consent',

        processRedirectionCallback: async params => {

            dataCenter = {
                region: params.location || null,
                accountsServer: trustedAccountsServer(params['accounts-server'])
            };
        },

        requestAccessToken: async context => {

            const { data, dataCenter: issuer } = await exchangeAuthorizationCode(context, dataCenterHint(context));
            dataCenter = { ...issuer, apiDomain: trustedApiDomain(data.api_domain) || issuer.apiDomain };

            return {
                accessToken: data.access_token,
                accessTokenExpDate: accessTokenExpDate(data),
                refreshToken: data.refresh_token
            };
        },

        accountNameFromProfileInfo: 'email',

        requestProfileInfo: async context => {

            const { data, dataCenter: found } = await findApiDataCenter(
                context,
                dataCenterHint(context),
                '/crm/v2/users?type=CurrentUser'
            );
            const user = Array.isArray(data?.users) ? data.users.pop() : null;
            if (!user) {
                throw new Error('Zoho returned no current user.');
            }
            return Object.assign(user, found);
        },

        refreshAccessToken: async context => {

            const data = await refreshToken(context);

            return {
                accessToken: data.access_token,
                accessTokenExpDate: accessTokenExpDate(data)
            };
        },

        validateAccessToken: async context => {

            return validateUser(context);
        }
    }
};
