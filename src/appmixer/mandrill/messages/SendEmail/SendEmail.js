'use strict';
const mandrill = require('mandrill-api/mandrill');
const Promise = require('bluebird');

/**
 * Mandrill email sender.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = new mandrill.Mandrill(context.auth.apiKey);
        let message = context.messages.in.content;
        let recipients = Array.isArray(message.to) ? message.to : [message.to];

        message.to = recipients.map(recipient => {
            return {
                'email': recipient,
                'type': 'to'
            };
        });

        return new Promise((resolve, reject) => {
            client.messages.send(
                { message },
                (result) => {
                    if (!result) {
                        return reject('Invalid response from mandrill.');
                    }
                    if (['sent', 'queued', 'scheduled'].indexOf(result[0].status) > -1) {
                        return resolve(result);
                    }
                    reject(new Error('Email status: ' + result[0].status +
                        (result[0].status === 'rejected' ? ', reason: ' + result[0]['reject_reason'] : '')
                    ));
                },
                err => {
                    reject(err);
                }
            );
        }).then(result => {
            return context.sendJson(result[0], 'out');
        });
    }
};
