'use strict';

const lib = require('../../lib');

const FIELDS = [
    'platform_type',
    'code_verification_status',
    'messaging_limit_tier',
    'display_phone_number',
    'verified_name',
    'quality_rating'
].join(',');

module.exports = {

    async receive(context) {

        const { phoneNumberId } = context.messages.in.content;

        if (!phoneNumberId) {
            throw new context.CancelError('Phone Number ID is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'GET',
            path: `/${phoneNumberId}`,
            params: { fields: FIELDS }
        });

        // A phone number is considered registered on Cloud API when
        // platform_type === "CLOUD_API". messaging_limit_tier also implies
        // registration but is not present on unregistered numbers.
        const platformType = data.platform_type || null;
        const registered = platformType === 'CLOUD_API';

        return context.sendJson({
            registered,
            platformType,
            codeVerified: data.code_verification_status === 'VERIFIED',
            codeVerificationStatus: data.code_verification_status || null,
            messagingLimit: data.messaging_limit_tier || null,
            displayPhoneNumber: data.display_phone_number || null,
            verifiedName: data.verified_name || null,
            qualityRating: data.quality_rating || null
        }, 'out');
    }
};
