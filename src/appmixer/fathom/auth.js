'use strict';

const lib = require('./lib');

// Fathom public API — API-key authentication.
//
// Keys are user-scoped and created in the Fathom developer dashboard
// (https://developers.fathom.ai) or under User Settings at fathom.video. Every request
// carries the key in the `X-Api-Key` header against https://api.fathom.ai/external/v1.
//
// A key only grants access to meetings recorded by the user who created it (or shared
// with their team) — admin keys do not expose other users' unshared meetings.
//
// There is no /me endpoint, so GET /meetings?limit=1 doubles as the credential check and
// the source of a human-readable account name.
module.exports = {

    type: 'apiKey',

    definition: {

        tokenType: 'authentication-token',

        auth: {
            apiKey: {
                type: 'password',
                name: 'API Key',
                tooltip: 'Create an API key in the Fathom developer dashboard at <a href="https://developers.fathom.ai" target="_blank">developers.fathom.ai</a>, or under <b>User Settings</b> at fathom.video. Keys are scoped to the user who creates them.'
            }
        },

        accountNameFromProfileInfo: 'email',

        requestProfileInfo: async (context) => {

            const { data } = await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/meetings`,
                headers: { 'X-Api-Key': context.apiKey },
                params: { limit: 1 }
            });

            // Fathom has no profile endpoint — derive the account name from the user who
            // recorded the most recent meeting. Brand-new accounts have no meetings yet,
            // so fall back to a static label rather than leaving the account unnamed.
            const items = (data && data.items) || [];
            const recordedBy = (items[0] && items[0].recorded_by) || {};
            const email = recordedBy.email || recordedBy.name || 'Fathom account';

            return { ...recordedBy, email };
        },

        validate: async (context) => {

            await context.httpRequest({
                method: 'GET',
                url: `${lib.API_BASE_URL}/meetings`,
                headers: { 'X-Api-Key': context.apiKey },
                params: { limit: 1 }
            });

            return true;
        }
    }
};
