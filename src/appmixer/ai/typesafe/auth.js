'use strict';

// TypeSafe authenticates every request with an API key sent as
// `Authorization: Bearer <key>`. There is no OAuth flow and no profile endpoint.
const API_BASE_URL = 'https://api.typesafe.ai';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                // eslint-disable-next-line max-len
                tooltip: 'Generate a key in the <a href="https://console.typesafe.ai/keys" target="_blank">TypeSafe console</a> under <b>API Keys</b>.'
            }
        },

        accountNameFromProfileInfo: 'name',

        requestProfileInfo(context) {

            // No whoami endpoint, so the account is labelled with the masked key.
            const apiKey = context.apiKey || '';
            return {
                name: apiKey.length > 8
                    ? `${apiKey.substring(0, 3)}...${apiKey.slice(-4)}`
                    : 'TypeSafe API key'
            };
        },

        async validate(context) {

            // GET /v1/models is free and rejects an invalid key with 401.
            try {
                await context.httpRequest({
                    method: 'GET',
                    url: `${API_BASE_URL}/v1/models`,
                    headers: {
                        Authorization: `Bearer ${context.apiKey}`
                    }
                });
            } catch (err) {
                if (err.response && err.response.status === 401) {
                    throw new Error('Invalid TypeSafe API key.');
                }
                // Rate limits, outages and network errors keep their original
                // message so a transient failure is not reported as a bad key.
                throw err;
            }

            return true;
        }
    }
};
