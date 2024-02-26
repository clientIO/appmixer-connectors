'use strict';
const request = require('request-promise');

/**
 * Component for sending push notifications through OneSignal.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { includedSegment } = context.properties;
        let { appId, apiKey } = context.auth;
        let message = context.messages.notification.content;

        let notification = {
            'app_id': appId,
            'contents': {
                'en': message.content
            },
            'included_segments': [includedSegment]
        };

        if (message.heading) {
            notification['headings'] = {
                'en': message.heading
            };
        }

        return request({
            method: 'POST',
            url: 'https://onesignal.com/api/v1/notifications',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                'Authorization': 'Basic ' + apiKey
            },
            json: notification
        }).then(response => {
            if (response && response.errors) {
                throw new context.CancelError(response.errors[0]);
            }
            return context.sendJson(response, 'out');
        });
    }
};
