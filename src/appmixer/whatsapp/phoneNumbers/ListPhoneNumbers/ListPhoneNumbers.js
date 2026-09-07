'use strict';

const lib = require('../../lib');

const FIELDS = [
    'id',
    'display_phone_number',
    'verified_name',
    'quality_rating',
    'code_verification_status',
    'platform_type',
    'throughput'
].join(',');

module.exports = {

    async receive(context) {

        const inputWaba = context.messages.in.content.businessAccountId;
        const profileWaba = context.profileInfo && context.profileInfo.businessAccountId;
        // Form input wins over the auto-discovered default from the OAuth profile.
        const businessAccountId = inputWaba || profileWaba;

        const isSource = !!(context.properties && context.properties.isSource);

        // Dropdown-source mode: still missing WABA → return empty silently.
        if (!businessAccountId) {
            if (isSource) {
                return context.sendJson({ phoneNumbers: [], count: 0 }, 'out');
            }
            throw new context.CancelError('Business Account ID is required!');
        }

        try {
            const path = `/${businessAccountId}/phone_numbers`;
            const params = { fields: FIELDS, limit: 100 };

            const { data } = isSource
                ? await lib.apiRequestCached(context, { path, params })
                : await lib.apiRequest(context, { method: 'GET', path, params });

            const phoneNumbers = (data.data || []).map(item => ({
                id: item.id,
                displayPhoneNumber: item.display_phone_number,
                verifiedName: item.verified_name,
                qualityRating: item.quality_rating,
                codeVerificationStatus: item.code_verification_status,
                platformType: item.platform_type,
                throughputLevel: item.throughput && item.throughput.level
            }));

            return context.sendJson({
                phoneNumbers,
                count: phoneNumbers.length
            }, 'out');

        } catch (err) {
            // In dropdown-source mode: never throw — return empty so the dropdown
            // degrades gracefully and the user can type the phoneNumberId manually.
            if (isSource) {
                return context.sendJson({ phoneNumbers: [], count: 0 }, 'out');
            }
            throw err;
        }
    },

    // Transformer used by other components' dynamic-source dropdowns.
    // Returns the [{ label, value }] shape the inspector expects.
    toSelectArray(out) {

        const phoneNumbers = (out && out.phoneNumbers) || [];

        return phoneNumbers.map((p) => {
            const display = p.displayPhoneNumber || p.id;
            const label = p.verifiedName ? `${display} — ${p.verifiedName}` : display;
            return { label, value: p.id };
        });
    }
};
