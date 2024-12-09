'use strict';

module.exports = {
    receive: async (context) => {
        const email = context.messages.email.content;
        const req = {
            method: 'GET',
            url: `https://verifyemail.io/api/email?verifyemail&email=${email.email}&apikey=${context.auth.apiKey}`,
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        };

        // Make the HTTP request
        const res = await context.httpRequest(req);

        // Check if the email is valid
        if (res.data.DOMAIN_VERDICT === 'Valid') {
            return context.sendJson(res.data, 'valid');
        } else {
            return context.sendJson(res.data, 'invalid');
        }
    }
};
