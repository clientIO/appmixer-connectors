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
                    tooltip: 'In Cliniko go to <i>My Info &rarr; Manage API keys &rarr; Create API key</i>, then paste the key here. '
                        + 'The key is sent as the HTTP Basic username with an empty password. '
                        + 'The region (shard) is read from the key itself, so no extra field is needed.'
                }
            },

            // GET /user is the cheapest authenticated call and has no side effects.
            validate: async (context) => {
                await context.httpRequest({
                    method: 'GET',
                    url: `${lib.getBaseUrl(context)}/user`,
                    headers: lib.getAuthHeaders(context)
                });
                return true;
            },

            accountNameFromProfileInfo: 'accountName',

            requestProfileInfo: async (context) => {

                const { data } = await context.httpRequest({
                    method: 'GET',
                    url: `${lib.getBaseUrl(context)}/user`,
                    headers: lib.getAuthHeaders(context)
                });

                const name = [data.first_name, data.last_name].filter(Boolean).join(' ');
                const shard = lib.getShard(context.apiKey);

                return {
                    accountName: `${name || data.email || 'Cliniko'} (${shard})`,
                    id: data.id,
                    email: data.email,
                    firstName: data.first_name,
                    lastName: data.last_name,
                    role: data.role,
                    timeZone: data.time_zone,
                    shard
                };
            }
        };
    }
};
