'use strict';

const BASE_URL = 'https://services.leadconnectorhq.com';
const API_VERSION = '2021-07-28';

module.exports = {

    async receive(context) {

        if (!context.messages.in.content.calendarId) {
            throw new context.CancelError('Calendar is required!');
        }
        if (!context.messages.in.content.contactId) {
            throw new context.CancelError('Contact ID is required!');
        }
        if (!context.messages.in.content.startTime) {
            throw new context.CancelError('Start Time is required!');
        }
        if (!context.messages.in.content.endTime) {
            throw new context.CancelError('End Time is required!');
        }

        const {
            calendarId,
            locationId,
            contactId,
            startTime,
            endTime,
            title,
            appointmentStatus,
            assignedUserId,
            address
        } = context.messages.in.content;
        const resolvedLocationId = locationId || context.auth.locationId;

        const body = {
            calendarId,
            locationId: resolvedLocationId,
            contactId,
            startTime,
            endTime
        };

        if (title) body.title = title;
        if (appointmentStatus) body.appointmentStatus = appointmentStatus;
        if (assignedUserId) body.assignedUserId = assignedUserId;
        if (address) body.address = address;

        const response = await context.httpRequest({
            method: 'POST',
            url: `${BASE_URL}/calendars/events/appointments`,
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`,
                'Content-Type': 'application/json',
                'Version': API_VERSION
            },
            data: body
        });

        const data = response.data.appointment || response.data;

        // Map fields with correct API field names
        const out = {
            id: data.id,
            title: data.title,
            calendarId: data.calendarId,
            locationId: data.locationId,
            contactId: data.contactId,
            startTime: data.startTime || data.start || data.startTimeUtc || data.startDatetime,
            endTime: data.endTime || data.end || data.endTimeUtc || data.endDatetime,
            appointmentStatus: data.appointmentStatus || data.status,
            assignedUserId: data.assignedUserId || data.userId,
            address: data.address,
            dateAdded: data.dateAdded || data.createdAt || data.dateCreated || data.created_at
        };

        return context.sendJson(out, 'out');
    }
};
