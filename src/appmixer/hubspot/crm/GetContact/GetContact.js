'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            email,
            contactId
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const emailQuery = email ? '&idProperty=email' : '';

        try {
            const { data } = await hs.call(
                'get', `crm/v3/objects/contacts/${contactId || encodeURIComponent(email)}`, {}, { query: 'archived=false'.concat(emailQuery) });

            return context.sendJson(data, 'contact');

        } catch (err) {
            if (err.status || (err.response && err.response.status) === 404) {
                return context.sendJson({  email, contactId  }, 'notFound');
            }
            throw err;
        }

    }
};

