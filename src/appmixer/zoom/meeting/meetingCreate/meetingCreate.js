'use strict';

const lib = require('../../lib');

module.exports = {

    receive: async function(context) {

        const { data } = await this.httpRequest(context);

        return context.sendJson(data, 'out');
    },

    httpRequest: async function(context) {

        // eslint-disable-next-line no-unused-vars
        const input = context.messages.in.content;

        let url = lib.getBaseUrl(context) + `/users/${input['userId']}/meetings`;

        const headers = {};

        const inputMapping = {
            'agenda': input['agenda'],
            'default_password': input['default_password'],
            'duration': input['duration'],
            'password': input['password'],
            'pre_schedule': input['pre_schedule'],
            'schedule_for': input['schedule_for'],
            'start_time': input['start_time'],
            'template_id': input['template_id'],
            'topic': input['topic'],
            'tracking_fields': input['tracking_fields'],
            'type': input['type'],
            'recurrence.end_date_time': input['recurrence|end_date_time'],
            'recurrence.end_times': input['recurrence|end_times'],
            'recurrence.monthly_day': input['recurrence|monthly_day'],
            'recurrence.monthly_week': input['recurrence|monthly_week'],
            'recurrence.monthly_week_day': input['recurrence|monthly_week_day'],
            'recurrence.repeat_interval': input['recurrence|repeat_interval'],
            'recurrence.type': input['recurrence|type'],
            'recurrence.weekly_days': input['recurrence|weekly_days'],
            'settings.additional_data_center_regions': input['settings|additional_data_center_regions'],
            'settings.allow_multiple_devices': input['settings|allow_multiple_devices'],
            'settings.alternative_hosts': input['settings|alternative_hosts'],
            'settings.alternative_hosts_email_notification': input['settings|alternative_hosts_email_notification'],
            'settings.approval_type': input['settings|approval_type'],
            'settings.approved_or_denied_countries_or_regions': input['settings|approved_or_denied_countries_or_regions'],
            'settings.audio': input['settings|audio'],
            'settings.authentication_domains': input['settings|authentication_domains'],
            'settings.authentication_exception': input['settings|authentication_exception'],
            'settings.authentication_option': input['settings|authentication_option'],
            'settings.auto_recording': input['settings|auto_recording'],
            'settings.breakout_room': input['settings|breakout_room'],
            'settings.calendar_type': input['settings|calendar_type'],
            'settings.close_registration': input['settings|close_registration'],
            'settings.cn_meeting': input['settings|cn_meeting'],
            'settings.contact_email': input['settings|contact_email'],
            'settings.contact_name': input['settings|contact_name'],
            'settings.email_notification': input['settings|email_notification'],
            'settings.encryption_type': input['settings|encryption_type'],
            'settings.focus_mode': input['settings|focus_mode'],
            'settings.global_dial_in_countries': input['settings|global_dial_in_countries'],
            'settings.host_video': input['settings|host_video'],
            'settings.in_meeting': input['settings|in_meeting'],
            'settings.jbh_time': input['settings|jbh_time'],
            'settings.join_before_host': input['settings|join_before_host'],
            'settings.language_interpretation': input['settings|language_interpretation'],
            'settings.meeting_authentication': input['settings|meeting_authentication'],
            'settings.meeting_invitees': input['settings|meeting_invitees'],
            'settings.mute_upon_entry': input['settings|mute_upon_entry'],
            'settings.participant_video': input['settings|participant_video'],
            'settings.private_meeting': input['settings|private_meeting'],
            'settings.registrants_confirmation_email': input['settings|registrants_confirmation_email'],
            'settings.registrants_email_notification': input['settings|registrants_email_notification'],
            'settings.registration_type': input['settings|registration_type'],
            'settings.show_share_button': input['settings|show_share_button'],
            'settings.use_pmi': input['settings|use_pmi'],
            'settings.waiting_room': input['settings|waiting_room'],
            'settings.watermark': input['settings|watermark'],
            'settings.host_save_video_order': input['settings|host_save_video_order'],
            'settings.alternative_host_update_polls': input['settings|alternative_host_update_polls']
        };
        let requestBody = {};
        lib.setProperties(requestBody, inputMapping);

        requestBody.start_time = requestBody.start_time.replace('Z', ''); requestBody.timezone = requestBody.timezone || 'UTC';

        headers['Authorization'] = 'Bearer ' + context.auth.accessToken;

        const req = {
            url: url,
            method: 'POST',
            data: requestBody,
            headers: headers
        };

        try {
            const response = await context.httpRequest(req);
            const log = {
                step: 'http-request-success',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: {
                    data: response.data,
                    status: response.status,
                    statusText: response.statusText,
                    headers: response.headers
                }
            };
            await context.log(log);
            return response;
        } catch (err) {
            const log = {
                step: 'http-request-error',
                request: {
                    url: req.url,
                    method: req.method,
                    headers: req.headers,
                    data: req.data
                },
                response: err.response ? {
                    data: err.response.data,
                    status: err.response.status,
                    statusText: err.response.statusText,
                    headers: err.response.headers
                } : undefined
            };
            await context.log(log);
            throw err;
        }
    }

};
