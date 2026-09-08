'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const {
            email,
            firstName,
            lastName,
            addressLine1,
            addressLine2,
            city,
            stateProvinceRegion,
            postalCode,
            country,
            alternateEmails,
            listIds
        } = context.messages.in.content;

        if (!email) {
            throw new context.CancelError('Email is required!');
        }

        const contact = { email };

        if (firstName) contact.first_name = firstName;
        if (lastName) contact.last_name = lastName;
        if (addressLine1) contact.address_line_1 = addressLine1;
        if (addressLine2) contact.address_line_2 = addressLine2;
        if (city) contact.city = city;
        if (stateProvinceRegion) contact.state_province_region = stateProvinceRegion;
        if (postalCode) contact.postal_code = postalCode;
        if (country) contact.country = country;

        if (alternateEmails) {
            contact.alternate_emails = alternateEmails.split(',').map(e => e.trim()).filter(e => e);
        }

        const body = { contacts: [contact] };

        if (listIds) {
            body.list_ids = listIds.split(',').map(id => id.trim()).filter(id => id);
        }

        const result = await lib.apiRequest(context, '/marketing/contacts', {
            method: 'PUT',
            data: body
        });

        return context.sendJson(result, 'out');
    }
};
