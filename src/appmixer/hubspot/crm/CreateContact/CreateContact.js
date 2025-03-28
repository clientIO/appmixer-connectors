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

        const customFieldsArray = context.messages.in.content.customProperties?.AND || [];
        const customProperties = customFieldsArray.reduce((acc, field) => {
            acc[field.name] = field.value;
            return acc;
        }, {});

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
                zip: zip || '',
                ...customProperties
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
            email: properties.email ? properties.email : '',
            company: properties.company ? properties.company : '',
            ...Object.keys(customProperties)
                .reduce((acc, key) => {
                    acc[key] = properties[key] || '';
                    return acc;
                }, {})
        }, 'contact');

    }
};
