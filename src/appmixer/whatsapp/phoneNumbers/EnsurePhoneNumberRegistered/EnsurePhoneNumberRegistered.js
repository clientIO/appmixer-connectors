'use strict';

const lib = require('../../lib');

async function checkRegistered(context, phoneNumberId) {

    const { data } = await lib.apiRequest(context, {
        method: 'GET',
        path: `/${phoneNumberId}`,
        params: { fields: 'platform_type' }
    });

    return {
        registered: data.platform_type === 'CLOUD_API',
        platformType: data.platform_type || null
    };
}

module.exports = {

    async receive(context) {

        const { phoneNumberId, pin, dataLocalizationRegion } = context.messages.in.content;

        if (!phoneNumberId) {
            throw new context.CancelError('Phone Number ID is required!');
        }
        if (!pin) {
            throw new context.CancelError('Two-step verification PIN is required!');
        }

        // 1) Check current status.
        const status = await checkRegistered(context, phoneNumberId);

        if (status.registered) {
            return context.sendJson({
                registered: true,
                wasAlreadyRegistered: true,
                platformType: status.platformType
            }, 'out');
        }

        // 2) Not registered — call /register.
        const body = {
            messaging_product: 'whatsapp',
            pin: String(pin)
        };
        if (dataLocalizationRegion) {
            body.data_localization_region = dataLocalizationRegion;
        }

        await lib.apiRequest(context, {
            method: 'POST',
            path: `/${phoneNumberId}/register`,
            data: body
        });

        // 3) Re-check to confirm registration succeeded and pick up the new platform_type.
        const after = await checkRegistered(context, phoneNumberId);

        return context.sendJson({
            registered: after.registered,
            wasAlreadyRegistered: false,
            platformType: after.platformType
        }, 'out');
    }
};
