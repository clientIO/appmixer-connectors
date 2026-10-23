'use strict';
const { dataCenterCandidates, resolveAccountsServer } = require('./endpoints');

// Zoho's token endpoint answers with HTTP 200 even when it refuses the request: the body then
// carries `{ error: 'invalid_code' }` and no `access_token`. Reading the token straight out of
// such a body stores `undefined` as the access token and an Invalid Date as its expiry, so the
// account keeps looking connected while every later call fails somewhere else entirely — the
// component reports "Access token not found" and nothing ever names the refusal.
//
// Seen on 2026-09-21: two accounts stopped working about an hour after being connected (the life
// of one access token) and `POST /accounts/<id>/test` answered a bare `{"ok":false}`.
//
// Documented reasons Zoho refuses a refresh, all of which look identical from the outside:
//   * the account has no refresh token — Zoho issues one only when the consent screen is really
//     shown, so a reconnect without `prompt=consent` yields an access token alone;
//   * the OAuth client belongs to a different data center — a `.com` client secret sent to
//     accounts.zoho.eu answers `invalid_code`;
//   * the refresh token was revoked, or the user has more than the allowed number of them.

const DEFAULT_EXPIRES_IN_SECONDS = 3600;

/**
 * Reads a Zoho token response, failing loudly when it is a refusal.
 * @param {Object} data Body of the token endpoint response.
 * @param {string} action What was attempted, for the error message.
 * @returns {Object} The same body, once it is known to carry a token.
 */
const assertTokenResponse = (data, action) => {

    if (!data || data.error) {
        throw new Error(
            `Zoho refused to ${action}: ${(data && data.error) || 'empty response'}. ` +
            'Reconnect the account. If it keeps happening, check that the OAuth client of the ' +
            "account's data center is used — a .com client secret sent to accounts.zoho.eu is " +
            'answered with invalid_code.'
        );
    }

    if (!data.access_token) {
        throw new Error(`Zoho returned no access token when asked to ${action}.`);
    }

    return data;
};

/**
 * Expiry of a freshly issued access token. Zoho states the lifetime in `expires_in` seconds;
 * an absent value would otherwise produce an Invalid Date that never looks expired.
 * @param {Object} data Body of the token endpoint response.
 * @returns {Date}
 */
const accessTokenExpDate = data => {

    const seconds = Number(data.expires_in);
    const date = new Date();
    date.setSeconds(date.getSeconds() + (Number.isFinite(seconds) ? seconds : DEFAULT_EXPIRES_IN_SECONDS));
    return date;
};

/**
 * Guards the refresh path before it builds a request out of a missing token.
 * @param {string} [refreshToken]
 */
const assertRefreshToken = refreshToken => {

    if (!refreshToken) {
        throw new Error(
            'This Zoho account has no refresh token, so it stops working about an hour after it ' +
            'was connected. Zoho issues one only when the consent screen is shown — reconnect the ' +
            'account, and make sure the authorization asks for consent (prompt=consent).'
        );
    }
};

// Answers of a token endpoint that does not know the authorization code: the code was issued by
// another data center (invalid_code), or the OAuth client is not enabled there (invalid_client).
const WRONG_DATA_CENTER_ERRORS = new Set(['invalid_code', 'invalid_client']);

// Answers of an API host that does not know the access token: 401 in CRM and Books alike, 404 where
// the product does not run at all (Books in the Singapore data center redirects to a 404 page).
const WRONG_DATA_CENTER_STATUSES = new Set([401, 404]);

const DATA_CENTER_PROBE_TIMEOUT = 10 * 1000;

/**
 * Asks the accounts servers of the given data centers for a token, one by one, and returns the
 * answer of the first that issues one. A data center that does not know the code or the refresh
 * token refuses it, so only the right one answers with a token.
 * @param {Object} context Auth context (clientId, clientSecret, httpRequest).
 * @param {Array<Object>} dataCenters Data centers to try (see dataCenterCandidates).
 * @param {string} grant Query string of the grant, without the client credentials.
 * @param {string} action What is attempted, for the error message.
 * @returns {Promise<{ data: Object, dataCenter: { region: String, accountsServer: String, apiDomain: String } }>}
 */
const requestToken = async (context, dataCenters, grant, action) => {

    const refusals = [];
    for (const dataCenter of dataCenters) {
        const tokenUrl = `${dataCenter.accountsServer}/oauth/v2/token?${grant}` +
            '&client_id=' + context.clientId +
            '&client_secret=' + context.clientSecret;

        let data;
        try {
            ({ data } = await context.httpRequest.post(tokenUrl, null, { timeout: DATA_CENTER_PROBE_TIMEOUT }));
        } catch (err) {
            if (!err.response?.data?.error) {
                if (dataCenters.length === 1) {
                    throw err;
                }
                refusals.push(`${dataCenter.region}: ${err.message}`);
                continue;
            }
            data = err.response.data;
        }
        if (dataCenters.length > 1 && data && WRONG_DATA_CENTER_ERRORS.has(data.error)) {
            refusals.push(`${dataCenter.region}: ${data.error}`);
            continue;
        }
        assertTokenResponse(data, action);
        return { data, dataCenter };
    }

    throw new Error(
        `No Zoho data center agreed to ${action} (${refusals.join(', ')}). Reconnect the account. ` +
        'If it keeps happening, check that the OAuth client is enabled for the data center of the ' +
        'account and uses the same client secret in all of them.'
    );
};

/**
 * Exchanges the authorization code at the accounts server of the account's data center.
 *
 * The data center is found by trying them, not remembered from the redirect callback: in the
 * Auth Hub the callback and the code exchange are separate requests that may land on different
 * processes, and the exchange gets only the code and the scope.
 * @param {Object} context Auth context (clientId, clientSecret, authorizationCode, callbackUrl).
 * @param {Object} [hint] Data center the redirect callback named, tried first when known.
 * @returns {Promise<{ data: Object, dataCenter: { region: String, accountsServer: String, apiDomain: String } }>}
 */
const exchangeAuthorizationCode = (context, hint) => {

    const grant = 'grant_type=authorization_code' +
        '&code=' + context.authorizationCode +
        '&redirect_uri=' + context.callbackUrl;
    return requestToken(context, dataCenterCandidates(hint), grant, 'issue an access token');
};

/**
 * Refreshes the access token at the accounts server of the account's data center.
 *
 * A token refreshed by the Auth Hub comes without the account's profileInfo, so the data center
 * the account was connected in is not known there. It is then found the same way as during the
 * code exchange. With profileInfo at hand only the account's own data center is asked.
 * @param {Object} context Auth context (clientId, clientSecret, refreshToken, profileInfo).
 * @returns {Promise<Object>} Body of the token endpoint response.
 */
const refreshToken = async context => {

    assertRefreshToken(context.refreshToken);

    const profileInfo = context.profileInfo || {};
    const dataCenters = (profileInfo.accountsServer || profileInfo.region)
        ? [{ region: profileInfo.region, accountsServer: resolveAccountsServer(profileInfo) }]
        : dataCenterCandidates();
    const grant = 'grant_type=refresh_token&refresh_token=' + context.refreshToken;
    const { data } = await requestToken(context, dataCenters, grant, 'refresh the access token');
    return data;
};

/**
 * Finds the data center whose API accepts the access token and returns its answer to `path`.
 * A data center that did not issue the token answers 401, or 404 where the product does not run.
 * @param {Object} context Auth context (accessToken, httpRequest).
 * @param {Object} [hint] Data center tried first (see dataCenterCandidates).
 * @param {string} path API path, e.g. '/crm/v2/users?type=CurrentUser'.
 * @returns {Promise<{ data: Object, dataCenter: { region: String, accountsServer: String, apiDomain: String } }>}
 */
const findApiDataCenter = async (context, hint, path) => {

    for (const dataCenter of dataCenterCandidates(hint)) {
        try {
            const { data } = await context.httpRequest({
                method: 'GET',
                url: dataCenter.apiDomain + path,
                headers: { 'Authorization': `Zoho-oauthtoken ${context.accessToken}` },
                timeout: DATA_CENTER_PROBE_TIMEOUT
            });
            return { data, dataCenter };
        } catch (err) {
            if (!WRONG_DATA_CENTER_STATUSES.has(err.response?.status)) {
                throw err;
            }
        }
    }

    throw new Error('No Zoho data center accepts the access token. Reconnect the account.');
};

module.exports = {
    exchangeAuthorizationCode,
    refreshToken,
    findApiDataCenter,
    assertTokenResponse,
    assertRefreshToken,
    accessTokenExpDate
};
