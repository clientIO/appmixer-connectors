'use strict';

// Tavily authenticates every request with a bearer API key (`tvly-…`). There is
// no OAuth2 flow, so API key is the only supported authentication method.
const API_BASE_URL = 'https://api.tavily.com';

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Sign up at <a href="https://app.tavily.com" target="_blank">app.tavily.com</a> and copy your key from the <b>API Keys</b> section. Keys start with <code>tvly-</code>.'
            }
        },

        accountNameFromProfileInfo: 'key',

        requestProfileInfo: async context => {

            // Tavily has no profile endpoint. /usage is the closest thing and is
            // free of charge, so we label the account with the masked key plus the
            // plan the key belongs to.
            const apiKey = context.apiKey || '';
            const key = apiKey.length > 12
                ? `${apiKey.substring(0, 8)}...${apiKey.slice(-4)}`
                : 'Tavily API key';

            let plan = null;
            try {
                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: `${API_BASE_URL}/usage`,
                    headers: {
                        'Authorization': `Bearer ${apiKey}`
                    }
                });
                plan = (data && data.account && data.account.current_plan) || null;
            } catch (err) {
                // The account label must not depend on /usage being reachable — a
                // transient failure here would otherwise block connecting a valid key.
                plan = null;
            }

            return { key, plan };
        },

        validate: async context => {

            // /usage costs no API credits and answers 401 for a bad key, which makes
            // it the cheapest possible validation call.
            try {
                await context.httpRequest({
                    method: 'GET',
                    url: `${API_BASE_URL}/usage`,
                    headers: {
                        'Authorization': `Bearer ${context.apiKey}`
                    }
                });
            } catch (err) {
                // Only the documented 401 means the key itself is wrong. Rate limits,
                // outages and network errors keep their original message so a transient
                // failure is not misreported as an invalid key.
                if (err.response && err.response.status === 401) {
                    throw new Error('Invalid Tavily API key.');
                }
                throw err;
            }

            return true;
        }
    }
};
