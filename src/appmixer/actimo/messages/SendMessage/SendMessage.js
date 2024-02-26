'use strict';
const request = require('request-promise');

/**
 * Component which will create a message and send it to recepients
 */
module.exports = {

    async receive(context) {

        const { text, recipients: contacts, groups = [] } = context.messages.message.content;
        const apiUrl = context.profileInfo.apiUrl;
        const { data: messagesData } = await request({
            method: 'POST',
            url: apiUrl + 'messages',
            headers: {
                'api-key': context.auth.apiKey
            },
            body: {
                modules: [
                    { type: 'text', text }
                ]
            },
            json: true
        });

        const id = messagesData[0].id;
        const sendResult = await request({
            method: 'POST',
            url: apiUrl + 'messages/' + id.toString() + '/send',
            headers: {
                'api-key': context.auth.apiKey
            },
            body: {
                id,
                contacts,
                groups,
                isTest: 0
            },
            json: true
        });

        context.sendJson(sendResult, 'result');
    }
};
