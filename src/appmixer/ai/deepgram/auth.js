'use strict';

const lib = require('./lib');

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {

            auth: {
                apiKey: {
                    type: 'password',
                    name: 'API Key',
                    tooltip: 'Sign in at <a href="https://console.deepgram.com" target="_blank">console.deepgram.com</a>, open a project and go to <i>Settings &rarr; API Keys &rarr; Create a New API Key</i>. Copy the key and paste it here. The key is sent as <code>Authorization: Token &lt;key&gt;</code>.'
                },
                region: {
                    type: 'select',
                    name: 'Region',
                    placeholder: 'Global (default)',
                    tooltip: 'Deepgram API region. Your API key works against every region &mdash; this only selects the base URL. Pick <b>Custom</b> to target a dedicated or self-hosted endpoint.',
                    options: [
                        { label: 'Global (api.deepgram.com)', value: 'global' },
                        { label: 'EU (api.eu.deepgram.com)', value: 'eu' },
                        { label: 'Australia (api.au.deepgram.com)', value: 'au' },
                        { label: 'Custom / self-hosted', value: 'custom' }
                    ]
                },
                customHost: {
                    type: 'text',
                    name: 'Custom Host',
                    tooltip: 'Only used when Region is set to <b>Custom</b>. Full base URL or host of a dedicated / self-hosted Deepgram endpoint, e.g. <code>https://abc123.us.api.deepgram.com</code> or <code>http://10.0.1.100:8080</code>.'
                }
            },

            validate: async (context) => {
                // GET /v1/projects is cheap, has no side effects and returns 401 on a bad key.
                await context.httpRequest({
                    method: 'GET',
                    url: `${lib.getBaseUrl(context)}/v1/projects`,
                    headers: lib.getAuthHeaders(context)
                });
                return true;
            },

            accountNameFromProfileInfo: 'accountName',

            // Deepgram has no "who am I" endpoint, so the profile is derived from the
            // credential itself. Never expose the raw key - only a masked form is stored.
            requestProfileInfo: async (context) => {

                const apiKey = context.apiKey || '';
                const masked = apiKey.length > 10
                    ? `${apiKey.substring(0, 6)}...${apiKey.substring(apiKey.length - 4)}`
                    : 'Deepgram';
                const region = context.region || 'global';
                const suffix = region !== 'global' ? ` (${region})` : '';

                return {
                    accountName: `${masked}${suffix}`,
                    region
                };
            }
        };
    }
};
