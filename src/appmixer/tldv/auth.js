'use strict';

const lib = require('./lib');

// tl;dv uses API-key authentication only (no OAuth2). The personal key is created at
// https://tldv.io/app/settings/personal-settings/api-keys and is sent in the `x-api-key`
// header on every request. There is no user/profile endpoint, so the account is validated
// against GET /v1alpha1/meetings?limit=1 (a bad key returns 401). The unauthenticated
// /v1alpha1/health endpoint must NOT be used for validation — it accepts any key.
module.exports = {
    type: 'apiKey',
    definition: {
        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'password',
                name: 'API Key',
                tooltip: 'Log into tl;dv and open <b>Settings → Personal Settings → API Keys</b> (<a href="https://tldv.io/app/settings/personal-settings/api-keys" target="_blank">tldv.io</a>), then click <i>Generate new API Key</i>. API access requires a paid plan (Pro, Business or Enterprise); the Free plan has no API access. Note that a meeting is only exportable via the API when its <b>organizer</b> is on a paid plan.'
            }
        },

        // There is no profile endpoint, so derive a stable display name from a masked key.
        accountNameFromProfileInfo: (context) => {
            const apiKey = context.apiKey || '';
            return apiKey.length > 10 ? `${apiKey.substr(0, 6)}...${apiKey.substr(-4)}` : 'tl;dv account';
        },

        validate: async (context) => {
            await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/${lib.API_VERSION}/meetings`,
                headers: {
                    'x-api-key': context.apiKey
                },
                params: { limit: 1 }
            });
            return true;
        }
    }
};
