'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const content = context.messages.in.content;
        const { phoneNumber, phoneType } = content;

        // Cliniko rejects a contact without a personal name - "first_name: or last name is
        // required" - even when Company Name is filled in. Say so before the API does.
        if (!content.firstName && !content.lastName) {
            throw new context.CancelError('First Name or Last Name is required!');
        }

        const body = lib.clean({
            first_name: content.firstName,
            last_name: content.lastName,
            preferred_name: content.preferredName,
            company_name: content.companyName,
            title: content.title,
            email: content.email,
            type_code: content.typeCode,
            doctor_type: content.doctorType,
            provider_number: content.providerNumber,
            occupation: content.occupation,
            address_1: content.address1,
            address_2: content.address2,
            address_3: content.address3,
            city: content.city,
            state: content.state,
            post_code: content.postCode,
            country_code: content.countryCode,
            notes: content.notes
        });

        if (phoneNumber) {
            body.phone_numbers = [{ number: phoneNumber, phone_type: phoneType || 'Work' }];
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: '/contacts',
            headers: { 'Content-Type': 'application/json' },
            data: body
        });

        return context.sendJson(data, 'out');
    }
};
