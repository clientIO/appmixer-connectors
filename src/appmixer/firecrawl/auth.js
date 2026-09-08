'use strict';

// Firecrawl authenticates every request with a personal API key sent as a
// Bearer token in the Authorization header. There is no OAuth2 flow, so API
// key is the only supported authentication method.
const API_BASE_URL = 'https://api.firecrawl.dev';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Sign up at <a href="https://www.firecrawl.dev/app" target="_blank">firecrawl.dev</a> and copy your key (starting with <b>fc-</b>) from the <b>API Keys</b> section of the dashboard.'
            }
        },

        accountNameFromProfileInfo: 'key',

        requestProfileInfo: async context => {

            // Firecrawl has no profile endpoint, so we derive a stable,
            // non-sensitive account label from the API key itself (masked).
            const apiKey = context.apiKey || '';
            const key = apiKey.length > 12
                ? `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}`
                : 'Firecrawl API key';

            return { key };
        },

        validate: async context => {

            // The team credit-usage endpoint is the cheapest authenticated call:
            // it costs no credits, answers 200 for a valid key and 401 for an
            // invalid one.
            try {
                await context.httpRequest({
                    method: 'GET',
                    url: `${API_BASE_URL}/v2/team/credit-usage`,
                    headers: {
                        'Authorization': `Bearer ${context.apiKey}`
                    }
                });
            } catch (err) {
                // Only the documented 401 means the key itself is wrong. Rate
                // limits, outages and network errors must keep their original
                // message so a transient failure is not misreported as an
                // invalid key.
                if (err.response && err.response.status === 401) {
                    throw new Error('Invalid Firecrawl API key.');
                }
                throw err;
            }

            return true;
        }
    }
};
