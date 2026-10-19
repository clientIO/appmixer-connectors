'use strict';

// Bright Data authenticates every REST call with an account API token sent as
// `Authorization: Bearer <token>`. There is no OAuth2 flow, so API key is the
// only supported authentication method.
const API_BASE_URL = 'https://api.brightdata.com';

module.exports = {

    name: 'appmixer:brightdata',

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Token',
                // eslint-disable-next-line max-len
                tooltip: 'Create an API token in the Bright Data control panel under <a href="https://brightdata.com/cp/setting/users" target="_blank">Account settings &rarr; API tokens</a> and paste it here.'
            }
        },

        accountNameFromProfileInfo: 'key',

        requestProfileInfo: context => {

            // Bright Data exposes no profile endpoint that is guaranteed to be
            // reachable for every account type, so the account is labelled with the
            // masked token. This is intentionally a pure function — nothing here may
            // fail, or connecting a perfectly valid token would be blocked.
            const apiKey = context.apiKey || '';
            const key = apiKey.length > 12
                ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`
                : 'Bright Data API token';

            return { key };
        },

        validate: async context => {

            // GET /zone/get_active_zones is a free account-management call: it bills
            // nothing, works for every account, and answers 401 for a bad token.
            try {
                await context.httpRequest({
                    method: 'GET',
                    url: `${API_BASE_URL}/zone/get_active_zones`,
                    headers: {
                        'Authorization': `Bearer ${context.apiKey}`
                    }
                });
            } catch (err) {
                const status = err.response && err.response.status;
                if (status === 401 || status === 403) {
                    throw new Error('Invalid Bright Data API token.');
                }
                // Rate limits, outages and network errors keep their original
                // message so a transient failure is not reported as a bad token.
                throw err;
            }

            return true;
        }
    }
};
