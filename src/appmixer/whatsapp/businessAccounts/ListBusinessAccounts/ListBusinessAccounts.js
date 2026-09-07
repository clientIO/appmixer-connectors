'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const profile = context.profileInfo || {};
        // WABA IDs are auto-discovered during OAuth (see auth.js) and stored
        // on the profile. No Graph API call is needed to list them.
        const wabaIds = Array.isArray(profile.wabaIds) && profile.wabaIds.length
            ? profile.wabaIds
            : (profile.businessAccountId ? [profile.businessAccountId] : []);

        const isSource = !!(context.properties && context.properties.isSource);

        if (!wabaIds.length) {
            if (isSource) {
                return context.sendJson({ businessAccounts: [], count: 0 }, 'out');
            }
            throw new context.CancelError(
                'The list of WhatsApp Business Accounts is not available for this connected '
                + 'account. Enter your WABA ID manually where needed — you can find it in '
                + 'Meta Business Manager (business.facebook.com → Settings → Accounts → '
                + 'WhatsApp Accounts).'
            );
        }

        // Best-effort name enrichment for readable dropdown labels. On any
        // failure fall back to bare IDs — never block on this call.
        let businessAccounts = wabaIds.map(id => ({ id: String(id), name: null }));
        try {
            const path = '/';
            const params = { ids: wabaIds.join(','), fields: 'id,name' };
            const { data } = isSource
                ? await lib.apiRequestCached(context, { path, params })
                : await lib.apiRequest(context, { method: 'GET', path, params });

            businessAccounts = wabaIds.map(id => {
                const item = data && data[id];
                return { id: String(id), name: (item && item.name) || null };
            });
        } catch (err) {
            // Name enrichment is best-effort — fall back to bare IDs.
        }

        return context.sendJson({
            businessAccounts,
            count: businessAccounts.length
        }, 'out');
    },

    // Transformer used by other components' dynamic-source dropdowns.
    // Returns the [{ label, value }] shape the inspector expects.
    toSelectArray(out) {

        const businessAccounts = (out && out.businessAccounts) || [];

        return businessAccounts.map(a => ({
            label: a.name ? `${a.name} (${a.id})` : a.id,
            value: a.id
        }));
    }
};
