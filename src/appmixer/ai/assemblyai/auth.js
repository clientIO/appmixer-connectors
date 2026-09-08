'use strict';

const BASE_URLS = {
    us: 'https://api.assemblyai.com',
    eu: 'https://api.eu.assemblyai.com'
};

module.exports = {

    type: 'apiKey',

    definition: () => {

        return {
            auth: {
                apiKey: {
                    type: 'text',
                    name: 'API Key',
                    tooltip: 'Sign in at <a href="https://www.assemblyai.com/dashboard/home" target="_blank">assemblyai.com/dashboard</a>, open <i>API Keys</i> and copy your key. Paste it here.'
                },
                region: {
                    type: 'select',
                    name: 'Region',
                    placeholder: 'US',
                    tooltip: 'The region your AssemblyAI account belongs to. Keys and uploaded files are <b>not</b> portable across regions, so this must match the region where the key was created.',
                    options: [
                        { label: 'US', value: 'us' },
                        { label: 'EU (data residency)', value: 'eu' }
                    ]
                }
            },

            validate: async (context) => {
                const baseUrl = BASE_URLS[context.region] || BASE_URLS.us;
                await context.httpRequest({
                    method: 'GET',
                    url: `${baseUrl}/v2/transcript?limit=1`,
                    headers: {
                        Authorization: context.apiKey
                    }
                });
                return true;
            },

            // API keys have no profile endpoint, so the obfuscated key plus the region
            // (keys are region-bound) is the profile info the account label is built from.
            requestProfileInfo: (context) => {
                const apiKey = context.apiKey || '';
                const region = (context.region || 'us').toUpperCase();
                return {
                    key: `${apiKey.substr(0, 6)}...${apiKey.substr(-4)} (${region})`,
                    region
                };
            },

            accountNameFromProfileInfo: 'key'
        };
    }
};
