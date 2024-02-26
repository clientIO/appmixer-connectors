'use strict';

const request = require('request-promise');

const PUSH_URL = 'https://developer.lametric.com/api/v1/dev/widget/update/com.lametric.50f60d1046590acaf9add96ec107816c';

module.exports = {

    receive(context) {

        let notification = context.messages.notification.content;
        return request({
            method: 'POST',
            url: PUSH_URL,
            json: {
                "frames": [
                    {
                        "text": notification.text,
                        "icon": notification.icon || null,
                        "index": 0
                    }
                ]
            },
            headers: {
                'Accept': 'application/json',
                //'Authorization': 'Bearer ' + context.auth.accessToken,
                //'X-Access-Token': 'NDEwY2EyZTVlN2RkYjFkZTM1MjUyNGIyMzU3OWQ4YWEwYWU1MzkwOTdlYjA3ZmI1MGU3NzQ5Y2IzMWViYTI4ZQ==',
                'X-Access-Token': context.auth.accessToken,
                'Cache-Control': 'no-cache'
            }
        }).then(() => {
            return context.sendJson(notification, 'done');
        });
    }
};

