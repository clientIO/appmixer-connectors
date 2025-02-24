'use strict';
const commons = require('../lib');

module.exports = {
    async receive(context) {
        const endpoint = '/users/me/settings/sendAs';
        const { data } = await commons.callEndpoint(context, endpoint, {
            method: 'GET'
        });

        // Check if sendAs array exists and map signatures
        const signatures = Array.isArray(data.sendAs) ? data.sendAs.filter(item => item.signature).map(item => ({
            email: item.sendAsEmail,
            signature: item.signature // Only include signatures that exist
        })) : [];

        // Send the signatures or an empty array if none exist
        return context.sendJson(signatures, 'out');
    },

    signaturesToSelectArray(signatures) {
        return Array.isArray(signatures) ? signatures.reduce((result, sign) => {
            if (sign.signature) { // Only create a label if signature exists
                let plainSignature = sign.signature
                    .replace(/<\/div><div[^>]*>/g, '\n') // Convert HTML div tags to line breaks
                    .replace(/<[^>]+>/g, '') // Strip other HTML tags
                    .substring(0, 50); // Limit signature length

                result.push({
                    label: `${sign.email} ( ${plainSignature} )`,
                    value: sign.signature
                });
            }
            return result;
        }, []) : [];
    }
};
