'use strict';

// Exa authenticates every request with a plain API key sent in the `x-api-key`
// header (an `Authorization: Bearer <key>` header is accepted too). There is no
// OAuth2 flow, so API key is the only supported authentication method.
const API_BASE_URL = 'https://api.exa.ai';

module.exports = {

    name: 'appmixer:ai:exa',

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                // eslint-disable-next-line max-len
                tooltip: 'Sign up at <a href="https://dashboard.exa.ai" target="_blank">dashboard.exa.ai</a> and copy your key from the <b>API Keys</b> page.'
            }
        },

        accountNameFromProfileInfo: 'key',

        requestProfileInfo: context => {

            // Exa exposes no profile endpoint, so the account is labelled with the
            // masked key. This is intentionally a pure function — nothing here may
            // fail, or connecting a perfectly valid key would be blocked.
            const apiKey = context.apiKey || '';
            const key = apiKey.length > 12
                ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`
                : 'Exa API key';

            return { key };
        },

        validate: async context => {

            // POST /contents with an empty body costs nothing: a valid key is
            // rejected with 400 INVALID_REQUEST_BODY (the key authenticated, the
            // body did not validate) while an invalid key is rejected with 401.
            // That makes it the cheapest possible way to check a key — every
            // endpoint that returns data bills the account.
            try {
                await context.httpRequest({
                    method: 'POST',
                    url: `${API_BASE_URL}/contents`,
                    headers: {
                        'x-api-key': context.apiKey,
                        'Content-Type': 'application/json'
                    },
                    data: {}
                });
            } catch (err) {
                const status = err.response && err.response.status;
                if (status === 401) {
                    throw new Error('Invalid Exa API key.');
                }
                if (status === 400) {
                    // Expected for a valid key — the empty body is what was rejected.
                    return true;
                }
                // Rate limits, outages and network errors keep their original
                // message so a transient failure is not reported as a bad key.
                throw err;
            }

            return true;
        }
    }
};
