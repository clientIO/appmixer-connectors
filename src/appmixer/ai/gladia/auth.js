'use strict';

// Gladia authenticates every request with a personal API key sent in the
// `x-gladia-key` header. There is no OAuth2 flow, so API key is the only
// supported authentication method.
const API_BASE_URL = 'https://api.gladia.io';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Sign up at <a href="https://app.gladia.io" target="_blank">app.gladia.io</a> and copy your key from the <b>API Keys</b> section (a default key is created on signup).'
            }
        },

        accountNameFromProfileInfo: 'key',

        requestProfileInfo: async context => {

            // Gladia has no profile endpoint, so we derive a stable, non-sensitive
            // account label from the API key itself (masked).
            const apiKey = context.apiKey || '';
            const key = apiKey.length > 12
                ? `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}`
                : 'Gladia API key';

            return { key };
        },

        validate: async context => {

            // Gladia exposes no dedicated auth endpoint. Listing a single job is
            // the cheapest authenticated call: it answers 200 for a valid key and
            // 401 for an invalid one.
            try {
                await context.httpRequest({
                    method: 'GET',
                    url: `${API_BASE_URL}/v2/transcription`,
                    headers: {
                        'x-gladia-key': context.apiKey
                    },
                    params: { limit: 1 }
                });
            } catch (err) {
                // Only the documented 401 means the key itself is wrong. Rate limits,
                // outages and network errors must keep their original message so a
                // transient failure is not misreported as an invalid key.
                if (err.response && err.response.status === 401) {
                    throw new Error('Invalid Gladia API key.');
                }
                throw err;
            }

            return true;
        }
    }
};
