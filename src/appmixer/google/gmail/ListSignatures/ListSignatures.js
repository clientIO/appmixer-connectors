'use strict';
const commons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const endpoint = '/users/me/settings/sendAs';
        const { data } = await commons.callEndpoint(context, endpoint, {
            method: 'GET'
        });

        // Extract signatures from sendAs
        const signatures = data.sendAs.map(item => ({
            email: item.sendAsEmail,
            signature: item.signature
        }));

        return context.sendJson(signatures, 'out');
    },

    signaturesToSelectArray(signatures) {
        return Array.isArray(signatures) ? signatures.reduce((result, sign) => {
            let plainSignature = sign.signature
                .replace(/<\/div><div[^>]*>/g, '\n')
                .replace(/<[^>]+>/g, '')
                .substring(0, 50);

            result.push({
                label: `${sign.email} ( ${plainSignature} )`,
                value: sign.signature
            });

            return result;
        }, []) : [];
    }
};
