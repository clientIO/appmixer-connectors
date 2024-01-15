'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

        const {
            contactId,
            email,
            firstname,
            lastname,
            phone,
            website,
            company,
            address,
            city,
            state,
            zip
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        const payload = {
            properties: {
                email,
                firstname,
                lastname,
                phone: phone,
                website: website,
                company:  company,
                address: address,
                city: city,
                state: state,
                zip: zip
            }
        };
        Object.keys(payload.properties).forEach(property => {
            if (!payload.properties[property]) {
                delete payload.properties[property];
            }
        });

        if (!Object.keys(payload.properties).length) {
            return context.sendJson({  email, contactId  }, 'notUpdated');
        }

        const query = (!contactId) ? 'idProperty=email' : '';
        const url = `crm/v3/objects/contacts/${contactId || encodeURIComponent(email)}`;

        const { data } = await hs.call('patch', url, payload, { query });

        return context.sendJson(data, 'updateContact');
    }
};

