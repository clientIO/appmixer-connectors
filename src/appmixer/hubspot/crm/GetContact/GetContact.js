'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            email,
            contactId,
            properties,
            associations
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);
        const params = {
            properties: properties || '',
            associations: associations || [],
            archived: false
        };

        if (email) {
            params.idProperty = 'email';
        }

        try {
            const url = `crm/v3/objects/contacts/${contactId || encodeURIComponent(email)}`;
            console.log(url);
            const { data } = await hs.call(
                'get',
                url,
                params
            );

            return context.sendJson(data, 'contact');

        } catch (err) {

            if (err.status || (err.response && err.response.status) === 404) {
                return context.sendJson({ email, contactId }, 'notFound');
            }
            throw err;
        }

    }
};

