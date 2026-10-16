'use strict';
const check = require('check-types');

// Zoho data centers, keyed by the `location` code Zoho sends in the OAuth redirect callback.
// The accounts server and the API host do not always share a TLD (Canada: accounts.zohocloud.ca
// vs. www.zohoapis.ca), so both are listed explicitly.
// See https://www.zoho.com/accounts/protocol/oauth/multi-dc.html; the current list of data centers
// is published at https://accounts.zoho.com/oauth/serverinfo.
const DATA_CENTERS = {
    'us': { accounts: 'https://accounts.zoho.com', api: 'https://www.zohoapis.com' },
    'eu': { accounts: 'https://accounts.zoho.eu', api: 'https://www.zohoapis.eu' },
    'in': { accounts: 'https://accounts.zoho.in', api: 'https://www.zohoapis.in' },
    'au': { accounts: 'https://accounts.zoho.com.au', api: 'https://www.zohoapis.com.au' },
    'cn': { accounts: 'https://accounts.zoho.com.cn', api: 'https://www.zohoapis.com.cn' },
    'jp': { accounts: 'https://accounts.zoho.jp', api: 'https://www.zohoapis.jp' },
    'ca': { accounts: 'https://accounts.zohocloud.ca', api: 'https://www.zohoapis.ca' },
    'sa': { accounts: 'https://accounts.zoho.sa', api: 'https://www.zohoapis.sa' },
    'uk': { accounts: 'https://accounts.zoho.uk', api: 'https://www.zohoapis.uk' },
    'ae': { accounts: 'https://accounts.zoho.ae', api: 'https://www.zohoapis.ae' },
    'sg': { accounts: 'https://accounts.zoho.sg', api: 'https://www.zohoapis.sg' }
};

const ACCOUNTS_SERVERS = new Set(Object.values(DATA_CENTERS).map(dc => dc.accounts));
const API_DOMAINS = new Set(Object.values(DATA_CENTERS).map(dc => dc.api));

/**
 * Data center of a region. An unknown region fails loudly: falling back to the US data center
 * sends the token or the API request to a server that does not know the account and the only
 * symptom is "Invalid access token".
 * @param {String} region
 * @returns {{ accounts: String, api: String }}
 */
const getDataCenter = region => {

    check.assert.string(region, `Missing region: ${region}.`);
    const dataCenter = DATA_CENTERS[region.toLowerCase()];
    if (!dataCenter) {
        throw new Error(`Unsupported Zoho data center: ${region}.`);
    }
    return dataCenter;
};

/**
 * Zoho Data Center specific account endpoint.
 * @param {String} region
 * @returns {String}
 */
const accountsEndpoint = region => getDataCenter(region).accounts;

/**
 * Zoho Data Center specific API endpoint.
 * @param {String} region
 * @returns {String}
 */
const apiEndpoint = region => getDataCenter(region).api;

/**
 * Normalizes a server URL Zoho handed over (`accounts-server` from the redirect callback,
 * `api_domain` from the token response) and accepts it only when it is a known Zoho host.
 * The access token and the client secret are sent there, so an arbitrary host is never trusted.
 * @param {String} [url]
 * @param {Set<String>} allowed
 * @returns {String|null}
 */
const trustedServer = (url, allowed) => {

    if (typeof url !== 'string' || !url) {
        return null;
    }
    const normalized = url.trim().replace(/\/+$/, '').toLowerCase();
    return allowed.has(normalized) ? normalized : null;
};

/**
 * Accounts server of an account: the `accounts-server` Zoho named in the redirect callback,
 * falling back to the region for accounts connected before it was stored.
 * @param {{ accountsServer?: String, region?: String }} [dataCenter]
 * @returns {String}
 */
const resolveAccountsServer = ({ accountsServer, region } = {}) => {

    return trustedServer(accountsServer, ACCOUNTS_SERVERS) || accountsEndpoint(region);
};

/**
 * API host of an account: the `api_domain` from the token response, falling back to the region
 * for accounts connected before it was stored.
 * @param {{ apiDomain?: String, region?: String }} [dataCenter]
 * @returns {String}
 */
const resolveApiDomain = ({ apiDomain, region } = {}) => {

    return trustedServer(apiDomain, API_DOMAINS) || apiEndpoint(region);
};

/**
 * All data centers in the order to try them when the account's data center is not known: the one
 * the hint points to first (region, accounts server or API host), the rest in DATA_CENTERS order.
 * The hint only orders the list, it is never trusted on its own: in the Auth Hub the redirect
 * callback, the code exchange and the profile request may run in different processes, so a hint
 * kept in memory can be missing or belong to another account being connected at the same time.
 * @param {{ region?: String, accountsServer?: String, apiDomain?: String }} [hint]
 * @returns {Array<{ region: String, accountsServer: String, apiDomain: String }>}
 */
const dataCenterCandidates = hint => {

    const { region, accountsServer, apiDomain } = hint || {};
    // Every data center tried sees the client secret and the code or token, so the list is walked
    // one by one and stops at the first that answers. China goes last: it is the least likely one
    // and the slowest to answer.
    const all = Object.entries(DATA_CENTERS)
        .map(([code, dc]) => ({ region: code, accountsServer: dc.accounts, apiDomain: dc.api }))
        .sort((a, b) => (a.region === 'cn') - (b.region === 'cn'));
    const accounts = trustedServer(accountsServer, ACCOUNTS_SERVERS);
    const api = trustedServer(apiDomain, API_DOMAINS);
    const hinted = all.find(dc => dc.accountsServer === accounts) ||
        all.find(dc => dc.apiDomain === api) ||
        all.find(dc => typeof region === 'string' && dc.region === region.toLowerCase());
    return hinted ? [hinted, ...all.filter(dc => dc !== hinted)] : all;
};

module.exports = {
    // accountsEndpoint and apiEndpoint are not used by this version of the connector any more. They
    // stay exported for older copies of auth.js and of the components: this file is shared by all
    // of them (the service version does not change), and the engine can still load an older
    // auth.js or component next to it - the Auth Hub in particular keeps older copies around.
    accountsEndpoint,
    apiEndpoint,
    dataCenterCandidates,
    resolveAccountsServer,
    resolveApiDomain,
    trustedAccountsServer: url => trustedServer(url, ACCOUNTS_SERVERS),
    trustedApiDomain: url => trustedServer(url, API_DOMAINS)
};
