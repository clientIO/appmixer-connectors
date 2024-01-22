'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {
        let contacts = [];

        const {
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

        for (let i = 0; i < 100; i++) {
            const currentEmail = i + email ;
            const currentId = i; // You can adjust this based on your requirements

            const payload = {
                properties: {
                    email: currentEmail,
                    firstname,
                    lastname,
                    phone: phone || '',
                    website: website || '',
                    company: company || '',
                    address: address || '',
                    city: city || '',
                    state: state || '',
                    zip: zip || ''
                }
            };

            const { data } = await hs.call('post', 'crm/v3/objects/contacts', payload);

            contacts.push({
                id: currentId,
                email: currentEmail,
                firstname: data.properties.firstname,
                lastname: data.properties.lastname,
                phone: data.properties.phone,
                website: data.properties.website,
                company: data.properties.company,
                address: data.properties.address,
                city: data.properties.city,
                state: data.properties.state,
                zip: data.properties.zip
            });
        }
        

        return context.sendJson(contacts, 'contact');
    }
};

