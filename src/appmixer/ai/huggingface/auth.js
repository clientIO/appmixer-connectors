'use strict';

// Hugging Face authenticates every request — both the Hub API on
// huggingface.co and the Inference Providers router on router.huggingface.co —
// with a User Access Token sent as `Authorization: Bearer hf_...`. There is no
// OAuth2 flow for machine-to-machine access, so API key is the only supported
// authentication method here.
const HUB_API_BASE_URL = 'https://huggingface.co';

module.exports = {

    name: 'appmixer:ai:huggingface',

    type: 'apiKey',

    definition: {

        auth: {
            apiKey: {
                type: 'text',
                name: 'User Access Token',
                // eslint-disable-next-line max-len
                tooltip: 'Create a token at <a href="https://huggingface.co/settings/tokens" target="_blank">huggingface.co/settings/tokens</a>. A fine-grained token needs the <b>Make calls to Inference Providers</b> permission; a classic <b>read</b> token works too.'
            }
        },

        accountNameFromProfileInfo: 'name',

        requestProfileInfo: async context => {

            // whoami-v2 is free and returns the account the token belongs to, so the
            // connected account is labelled with the real user or org name. A failure
            // here must never block connecting a working token, so any error falls
            // back to the masked token.
            try {
                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: `${HUB_API_BASE_URL}/api/whoami-v2`,
                    headers: {
                        Authorization: `Bearer ${context.apiKey}`
                    }
                });

                if (data && data.name) {
                    return { name: data.fullname ? `${data.fullname} (${data.name})` : data.name };
                }
            } catch (error) {
                // Fall through to the masked token below.
            }

            const apiKey = context.apiKey || '';
            const name = apiKey.length > 12
                ? `${apiKey.substring(0, 6)}...${apiKey.slice(-4)}`
                : 'Hugging Face token';

            return { name };
        },

        validate: async context => {

            // GET /api/whoami-v2 is the cheapest possible check: it costs no
            // inference credits and answers 401 for a bad or revoked token.
            try {
                await context.httpRequest({
                    method: 'GET',
                    url: `${HUB_API_BASE_URL}/api/whoami-v2`,
                    headers: {
                        Authorization: `Bearer ${context.apiKey}`
                    }
                });
            } catch (error) {
                const status = error.response && error.response.status;
                if (status === 401 || status === 403) {
                    throw new Error('Invalid Hugging Face User Access Token.');
                }
                // Rate limits, outages and network errors keep their original message
                // so a transient failure is not reported as a bad token.
                throw error;
            }

            return true;
        }
    }
};
