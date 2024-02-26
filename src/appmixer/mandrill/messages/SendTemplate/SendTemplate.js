'use strict';
const mandrill = require('mandrill-api/mandrill');
const _ = require('lodash');
const Promise = require('bluebird');

/**
 * Mandrill send template.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = new mandrill.Mandrill(context.auth.apiKey);
        let { subject, template, fromName, fromEmail, to, variables } = context.messages.in.content;
        to = [{ email: to }];

        let vars;
        try {
            vars = _.map(variables, (value, key) => {
                return { name: key, content: value };
            });
        } catch (err) {
            context.sendError(err);
            context.cancel(err);
            return;
        }

        return new Promise((resolve, reject) => {
            client.messages.sendTemplate(
                {
                    'template_name': template,
                    'template_content': [],
                    'message': {
                        to: to,
                        subject: subject,
                        'from_name': fromName ? fromName : fromEmail,
                        'from_email': fromEmail,
                        'global_merge_vars': vars
                    }
                },
                result => {
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
