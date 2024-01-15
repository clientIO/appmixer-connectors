'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {

    async receive(context) {

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

        const payload = {
            properties: {
                email,
                firstname,
                lastname,
                phone: phone || '',
                website: website || '',
                company:  company || '',
                address: address || '',
                city: city || '' ,
                state: state || '' ,
                zip: zip || ''
            }
        };
        const { data } = await hs.call('post', 'crm/v3/objects/contacts', payload);
        const { properties } = data;

        return context.sendJson({
            id: data.id,
            website: properties.website ? properties.website : '',
            city: properties.city ? properties.city : '',
            firstname: properties.firstname ? properties.firstname : '',
            zip: properties.zip ? properties.zip : '',
            lastname: properties.lastname ? properties.lastname : '',
            phone: properties.phone ? properties.phone : '',
            state: properties.state ? properties.state : '',
            address: properties.address ? properties.address : '',
            email: properties.email ? properties.email : ''
        }, 'contact');

    }
};
