'use strict';

const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'API Key',
                tooltip: 'Create a key at <a href="https://fal.ai/dashboard/keys" target="_blank">fal.ai/dashboard/keys</a>. The secret is shown only once and belongs to your whole account or team (members share a single key). Paste the <code>FAL_KEY</code> value here.'
            }
        },

        requestProfileInfo(context) {
            const apiKey = context.apiKey || '';
            return {
                key: apiKey.length > 16
                    ? `${apiKey.substring(0, 12)}...${apiKey.slice(-4)}`
                    : 'fal API key'
            };
        },

        accountNameFromProfileInfo: 'key',

        validate: async (context) => {

            // Validated against /v1/models, which works with an API-scoped key
            // (the common case). Do NOT use /v1/storage/settings — it is ADMIN-only
            // and returns 403 for ordinary API keys, so it would reject valid
            // connections.
            //
            // /v1/models allows ANONYMOUS reads (no header => 200), but any request
            // that DOES send an Authorization header is authenticated strictly:
            // an empty, malformed, or wrong key all return 401. Since we always send
            // the header, a broken credential can never pass this check.
            await context.httpRequest({
                method: 'GET',
                url: `${lib.PLATFORM_URL}/models`,
                headers: {
                    Authorization: `Key ${context.apiKey}`
                },
                params: { limit: 1 }
            });
            return true;
        }
    }
};
