'use strict';

const lib = require('../../lib');

/**
 * Map the camelCase inspector inputs onto the Cliniko patient payload.
 * @param {object} content
 * @returns {object}
 */
function buildBody(content) {

    const {
        firstName,
        lastName,
        preferredFirstName,
        title,
        email,
        dateOfBirth,
        sex,
        genderIdentity,
        occupation,
        phoneNumber,
        phoneType,
        address1,
        address2,
        address3,
        city,
        state,
        postCode,
        countryCode,
        notes,
        appointmentNotes,
        emergencyContact,
        referralSource,
        timeZone,
        medicare,
        acceptedEmailMarketing,
        acceptedSmsMarketing,
        acceptedPrivacyPolicy,
        receivesConfirmationEmails,
        receivesCancellationEmails
    } = content;

    const body = lib.clean({
        first_name: firstName,
        last_name: lastName,
        preferred_first_name: preferredFirstName,
        title: title,
        email: email,
        date_of_birth: dateOfBirth,
        sex: sex,
        gender_identity: genderIdentity,
        occupation: occupation,
        address_1: address1,
        address_2: address2,
        address_3: address3,
        city: city,
        state: state,
        post_code: postCode,
        country_code: countryCode,
        notes: notes,
        appointment_notes: appointmentNotes,
        emergency_contact: emergencyContact,
        referral_source: referralSource,
        time_zone: timeZone,
        medicare: medicare,
        accepted_email_marketing: acceptedEmailMarketing,
        accepted_sms_marketing: acceptedSmsMarketing,
        accepted_privacy_policy: acceptedPrivacyPolicy,
        receives_confirmation_emails: receivesConfirmationEmails,
        receives_cancellation_emails: receivesCancellationEmails
    });

    if (phoneNumber) {
        body.patient_phone_numbers = [{ number: phoneNumber, phone_type: phoneType || 'Mobile' }];
    }

    return body;
}

module.exports = {

    async receive(context) {

        const content = context.messages.in.content;

        if (!content.lastName) {
            throw new context.CancelError('Last Name is required!');
        }

        const { data } = await lib.apiRequest(context, {
            method: 'POST',
            path: '/patients',
            headers: { 'Content-Type': 'application/json' },
            data: buildBody(content)
        });

        return context.sendJson(data, 'out');
    }
};
