'use strict';

const lib = require('./lib');

// SAP Emarsys offers only the client_credentials grant — there is no multitenant OAuth app, every
// customer creates their own credential under Management > Security Settings > API Credentials.
// The token request itself is authenticated with a Basic header and the resulting JWT is valid for
// one hour, so `pwd` (validate returns { token, expires }) is the right type: the engine caches the
// token instead of re-requesting it per call. That matters here because the token endpoint is
// rate limited far more tightly than the API (50/min and 200/hour per client_id).
module.exports = {

    type: 'pwd',

    definition: {

        auth: {
            clientId: {
                type: 'text',
                name: 'Client ID',
                tooltip: 'The Client ID of an Emarsys API credential (Management > Security Settings > API Credentials). Only the Account Owner can create one.'
            },
            clientSecret: {
                type: 'text',
                name: 'Client Secret',
                tooltip: 'The Client Secret shown once when the API credential was created. All endpoint permissions are disabled by default — grant at least <code>customer.settings</code>, <code>contact.list</code>, <code>contact.getdata</code> and <code>field.list</code>.'
            },
            tokenUrl: {
                type: 'text',
                name: 'Token URL (optional)',
                tooltip: `Optional. Leave empty to use <code>${lib.DEFAULT_TOKEN_URL}</code>. Set it only when your tokens are issued by your own SAP Cloud Identity (OpenID Connect) tenant.`
            },
            loyaltyApiKey: {
                type: 'text',
                name: 'Loyalty API Key (optional)',
                tooltip: 'Optional, and needed only by the Get Loyalty Status component. Emarsys Loyalty is a separate API with its own key, created under Loyalty Configuration > API Key — it is <em>not</em> the same as the Client Secret above.'
            }
        },

        // A client_credentials credential carries no user identity, so the masked Client ID is the
        // only thing that distinguishes two Emarsys accounts in the account picker.
        accountNameFromProfileInfo: context => {
            return `SAP Emarsys (${lib.maskSecret(context.clientId)})`;
        },

        validate: async context => {

            const tokenUrl = lib.normalizeTokenUrl(context.tokenUrl);
            const basic = Buffer.from(`${context.clientId}:${context.clientSecret}`).toString('base64');

            const { data } = await context.httpRequest({
                method: 'POST',
                url: tokenUrl,
                headers: {
                    Authorization: `Basic ${basic}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                    Accept: 'application/json'
                },
                data: new URLSearchParams({ grant_type: 'client_credentials' }).toString(),
                timeout: lib.getRequestTimeout(context)
            });

            if (!data || !data.access_token) {
                throw new Error(`${tokenUrl} did not return an access token. Check the Client ID and Client Secret.`);
            }

            return {
                token: data.access_token,
                expires: data.expires_in
            };
        }
    }
};
