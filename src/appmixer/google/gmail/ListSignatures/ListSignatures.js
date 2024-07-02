'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons'); //endpoint call in google common function
const { promisify } = require('util');

// GoogleApi initialization & promisify of some api function for convenience
// const gmail = GoogleApi.gmail('v1');

module.exports = {
    async receive(context) {
        const params = {
            method: "GET",
            url: `https://gmail.googleapis.com/gmail/v1/users/me/settings/sendAs`,
            headers: {
                Authorization: `Bearer ${context.auth.accessToken}`
            }
        };
        const { data } = await context.httpRequest(params);
        context.log({ data });

        // Extract signatures from sendAs
        const signatures = data.sendAs.map(item => ({
            email: item.sendAsEmail,
            signature: item.signature
        }));

        return context.sendJson(signatures, 'out');
    },

    signaturesToSelectArray(signatures) {
        let transformed = [];
        if (Array.isArray(signatures)) {
            signatures.forEach(sign => {
                let item = {
                    label: sign.email,
                    value: sign.signature
                };
                transformed.push(item);
            });
        }
        return transformed;
    }
};
