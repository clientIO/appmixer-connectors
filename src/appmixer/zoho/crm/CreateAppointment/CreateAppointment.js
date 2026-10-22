'use strict';
const ZohoClient = require('../../ZohoClient');
const lib = require('../lib');

const LOCATION_CLIENT_ADDRESS = 'Client Address';

/**
 * Schedule an appointment. Appointments live in the Services module (Appointments__s), which has
 * to be enabled in the Zoho CRM organization.
 */
module.exports = {

    async receive(context) {

        const {
            appointmentName,
            appointmentForId,
            appointmentForModule,
            serviceId,
            ownerId,
            startTime,
            location,
            address,
            additionalInformation
        } = context.messages.in.content;

        if (!appointmentName) {
            throw new context.CancelError('Appointment Name is required!');
        }
        if (!appointmentForId) {
            throw new context.CancelError('Appointment For is required!');
        }
        if (!serviceId) {
            throw new context.CancelError('Service ID is required!');
        }
        if (!ownerId) {
            throw new context.CancelError('Owner ID is required!');
        }
        if (!startTime) {
            throw new context.CancelError('Start Time is required!');
        }
        if (!location) {
            throw new context.CancelError('Location is required!');
        }
        if (location === LOCATION_CLIENT_ADDRESS && !address) {
            throw new context.CancelError('Address is required when the location is Client Address!');
        }

        if (Number.isNaN(new Date(startTime).getTime())) {
            throw new context.CancelError(`Start Time "${startTime}" is not a valid date!`);
        }
        // Zoho rejects milliseconds and the 'Z' suffix, formatDateTime() emits +00:00.
        const appointmentStartTime = lib.formatDateTime(startTime);

        const appointment = {
            Appointment_Name: appointmentName,
            Appointment_For: {
                module: { api_name: appointmentForModule || 'Contacts' },
                id: appointmentForId
            },
            Service_Name: { id: serviceId },
            Owner: ownerId,
            Appointment_Start_Time: appointmentStartTime,
            Location: location
        };
        if (address) {
            appointment.Address = address;
        }
        if (additionalInformation) {
            appointment.Additional_Information = additionalInformation;
        }

        // The Appointments module is only exposed from API v5 up, hence the version override.
        const client = new ZohoClient(context, undefined, { apiVersion: lib.APPOINTMENTS_API_VERSION });
        const { details } = await client.executeRecordsRequest('POST', lib.APPOINTMENTS_MODULE, [appointment]);

        // The create response carries only the ID and audit fields; read the record back so the
        // output has the values Zoho computes (end time, duration, status).
        const record = await client.getRecord(lib.APPOINTMENTS_MODULE, details.id);

        // The create payload carries Owner as a bare id, while the out port declares it as an
        // object like every other lookup, so the fallback has to reshape it — otherwise a flow
        // reading Owner.name off this branch gets a character of a string.
        return context.sendJson(record || { ...appointment, Owner: { id: ownerId }, ...details }, 'out');
    }
};
