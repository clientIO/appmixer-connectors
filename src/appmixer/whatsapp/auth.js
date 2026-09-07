'use strict';

const GRAPH_VERSION = 'v25.0';

module.exports = {

    type: 'oauth2',

    definition: {

        // Used by the plain OAuth flow. Meta shows the WABA asset picker for
        // these scopes automatically — no Login Configuration needed.
        // NOTE: do NOT add business_management here — apps created with the
        // "WhatsApp" use case may only request whatsapp_* permissions and
        // Meta rejects the whole dialog with "Invalid Scopes" otherwise.
        scope: [
            'whatsapp_business_messaging',
            'whatsapp_business_management'
        ],

        // Two flows:
        //
        // 1. WhatsApp Embedded Signup — when Backoffice sets
        //    `appmixer:whatsapp.esConfigId` (ID of a "WhatsApp Embedded
        //    Signup" Login Configuration). Auth starts on our plugin-served
        //    page running Meta's signup wizard via the FB JS SDK — users
        //    select or even create a WABA + phone number, and the issued
        //    token carries enumerable WABA target_ids. Prerequisites on the
        //    Meta App: verified business, advanced access for the whatsapp
        //    scopes, Appmixer API domain in "Allowed Domains for the
        //    JavaScript SDK".
        //
        // 2. Plain OAuth fallback — no Backoffice config beyond
        //    clientId/clientSecret. Explicit `scope`; Meta shows the WABA
        //    asset picker on its own. WABA IDs are usually NOT enumerable
        //    from the resulting token (see requestProfileInfo), so users
        //    pick/enter the WABA ID manually in components.
        authUrl: async context => {

            const esConfigId = context.config.esConfigId;
            if (esConfigId) {
                const query = new URLSearchParams({
                    'state': context.ticket,
                    'redirect_uri': context.callbackUrl
                });
                return `${context.appmixerApiUrl}/plugins/appmixer/whatsapp/signup?` + query.toString();
            }

            const params = {
                'client_id': context.clientId,
                'redirect_uri': context.callbackUrl,
                'response_type': 'code',
                'state': context.ticket,
                'scope': context.scope.join(','),
                // Force re-prompting of previously declined/revoked permissions.
                // Without it Meta silently reuses the existing Business
                // Integration grant — the asset picker still shows, but the
                // token comes back with the old (possibly public_profile-only)
                // scopes.
                'auth_type': 'rerequest'
            };

            return `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth?` + new URLSearchParams(params).toString();
        },

        requestAccessToken: async context => {

            const params = {
                'client_id': context.clientId,
                'client_secret': context.clientSecret,
                'code': context.authorizationCode
            };

            // Codes issued by the FB JS SDK (Embedded Signup) must be
            // exchanged WITHOUT redirect_uri; codes from the redirect flow
            // require it to match the dialog's redirect_uri exactly.
            if (!(context.config && context.config.esConfigId)) {
                params['redirect_uri'] = context.callbackUrl;
            }

            const url = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
            const response = await context.httpRequest.get(url + '?' + new URLSearchParams(params).toString());

            const expiresIn = response.data['expires_in'];
            const accessTokenExpDate = expiresIn
                ? new Date(Date.now() + expiresIn * 1000)
                : undefined;

            return {
                accessToken: response.data['access_token'],
                accessTokenExpDate
            };
        },

        accountNameFromProfileInfo: context => {

            return context.profileInfo['name'] || context.profileInfo['id'].toString();
        },

        requestProfileInfo: async context => {

            // 1) Basic user profile.
            const meUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me?access_token=${context.accessToken}`;
            const me = await context.httpRequest.get(meUrl);

            const profile = { ...me.data };

            // 2) Discover the user's WABA(s) via /debug_token granular_scopes.
            //    Embedded-Signup-issued tokens carry the selected WABA under
            //    `granular_scopes[].target_ids`; plain-OAuth tokens usually
            //    don't (unrestricted grant) — then auth still passes and the
            //    WABA ID is entered manually in components.
            //
            //    A token without ANY whatsapp scope is useless — fail loud.
            //    Meta drops scopes silently (stale Business Integration
            //    grants, standard access without an app role, …), so without
            //    this check the account would connect and every component
            //    call would fail with a permission error.

            const wabaScopes = ['whatsapp_business_management', 'whatsapp_business_messaging'];

            let debugError = null;
            let debugData = null;
            let granular = null;
            // Granted at all (with or without asset restriction). A granular
            // entry WITHOUT `target_ids` means the grant is unrestricted —
            // "all current and future WABAs" — so the token has WhatsApp
            // access even though no IDs are enumerable from /debug_token.
            let whatsappScopeGranted = false;
            const wabaIds = [];

            try {
                const appAccessToken = `${context.clientId}|${context.clientSecret}`;
                const debugUrl = `https://graph.facebook.com/${GRAPH_VERSION}/debug_token`
                    + `?input_token=${encodeURIComponent(context.accessToken)}`
                    + `&access_token=${encodeURIComponent(appAccessToken)}`;
                const debug = await context.httpRequest.get(debugUrl);
                debugData = (debug && debug.data && debug.data.data) || {};

                if (Array.isArray(debugData.scopes)) {
                    whatsappScopeGranted = debugData.scopes.some(s => wabaScopes.includes(s));
                }
                granular = debugData.granular_scopes;
                if (Array.isArray(granular)) {
                    for (const entry of granular) {
                        if (!entry || !wabaScopes.includes(entry.scope)) continue;
                        whatsappScopeGranted = true;
                        if (Array.isArray(entry.target_ids)) {
                            for (const id of entry.target_ids) {
                                if (id && !wabaIds.includes(id)) wabaIds.push(id);
                            }
                        }
                    }
                }
            } catch (err) {
                debugError = err;
            }

            // Unrestricted grant — try to enumerate WABAs via Business Manager.
            // Works only when business_management was also granted; best-effort.
            if (!wabaIds.length && whatsappScopeGranted) {
                try {
                    const bizUrl = `https://graph.facebook.com/${GRAPH_VERSION}/me/businesses`
                        + '?fields=owned_whatsapp_business_accounts{id},client_whatsapp_business_accounts{id}'
                        + `&access_token=${encodeURIComponent(context.accessToken)}`;
                    const biz = await context.httpRequest.get(bizUrl);
                    for (const business of ((biz.data && biz.data.data) || [])) {
                        for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
                            for (const waba of ((business[edge] && business[edge].data) || [])) {
                                if (waba.id && !wabaIds.includes(waba.id)) wabaIds.push(waba.id);
                            }
                        }
                    }
                } catch (err) {
                    // Best-effort — ignore (e.g. business_management not granted).
                }
            }

            if (wabaIds.length > 0) {
                profile.businessAccountId = wabaIds[0];   // default WABA
                profile.wabaIds = wabaIds;                // full list, used by ListBusinessAccounts
                return profile;
            }

            // Token has WhatsApp access but the WABA list is not enumerable
            // (unrestricted grant without business_management). Pass — users
            // enter the WABA ID manually in components.
            if (whatsappScopeGranted) {
                return profile;
            }

            if (debugError) {
                throw new Error(
                    'Could not verify access to a WhatsApp Business Account '
                    + `(token inspection failed: ${debugError.message}). `
                    + 'Please try connecting the account again.'
                );
            }
            throw new Error(
                'The connected Facebook account did not grant the WhatsApp permissions '
                + '(whatsapp_business_management, whatsapp_business_messaging). '
                + 'Please disconnect and reconnect, approving the requested permissions and '
                + 'selecting at least one WhatsApp Business Account when the picker appears. '
                + 'If your Meta account has no WhatsApp Business Account, create one in '
                + 'Meta Business Manager (business.facebook.com → Settings → Accounts → '
                + 'WhatsApp Accounts → Add) before reconnecting.'
            );
        },

        refreshAccessToken: async context => {

            const params = {
                'client_id': context.clientId,
                'client_secret': context.clientSecret,
                'grant_type': 'fb_exchange_token',
                'fb_exchange_token': context.accessToken
            };

            const url = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
            const response = await context.httpRequest.get(url + '?' + new URLSearchParams(params).toString());

            const expiresIn = response.data['expires_in'];
            const accessTokenExpDate = expiresIn
                ? new Date(Date.now() + expiresIn * 1000)
                : undefined;

            return {
                accessToken: response.data['access_token'],
                accessTokenExpDate
            };
        },

        validateAccessToken: async context => {

            try {
                const url = `https://graph.facebook.com/${GRAPH_VERSION}/me?access_token=${context.accessToken}`;
                await context.httpRequest.get(url);
                return true;
            } catch (err) {
                return false;
            }
        }
    }
};
