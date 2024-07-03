'use strict';

module.exports = {
    async receive(context) {
        const params = {
            method: 'GET',
            url: 'https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs',
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            }
        };
        const { data } = await context.httpRequest(params);

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
                .replace(/<[^>]+>/g, '');

            result.push({
                label: `${sign.email} ( ${plainSignature} )`,
                value: sign.signature
            });

            return result;
        }, []) : [];

    }

};
