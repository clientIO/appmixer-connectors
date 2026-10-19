'use strict';
const ZohoClient = require('../ZohoClient');
const { trustedAccountsServer, trustedApiDomain } = require('../endpoints');
const {
    exchangeAuthorizationCode,
    findApiDataCenter,
    refreshToken,
    accessTokenExpDate
} = require('../oauth');

/**
 * Validate user - get user info. The data center is taken from context.profileInfo, or from the
 * account being connected (dataCenter) when there is no profileInfo yet.
 * @param {*} context
 * @return {Promise<*|null>}
 */
const validateUser = async (context) => {

    const zc = new ZohoClient(context, dataCenter);
    const { organizations } = await zc.request('GET', '/books/v3/organizations');
    return defaultOrganization(organizations);
};

/**
 * @param {Array} organizations
 * @return {Object|undefined}
 */
const defaultOrganization = organizations => {

    if (!organizations || organizations.length === 0) {
        // This suggests Zoho user hasn't created any organization yet.
        throw new Error('No organizations found for this account.');
    }
    // Select the default organization. This is the only endpoint that doesn't require the organization id.
    return organizations.find(org => org.is_default_org);
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

    name: 'appmixer:zoho:books',

    definition: {

        scope: [
            'ZohoBooks.settings.READ'
        ],

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
                '/books/v3/organizations'
            );
            const organization = defaultOrganization(data?.organizations);
            if (!organization) {
                throw new Error('This Zoho Books account has no default organization.');
            }
            return Object.assign(organization, found);
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
