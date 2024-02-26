'use strict';
const commons = require('../../raynet-commons');

/**
 * Create new person in Raynet.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const instanceName = context.auth.instanceName;
        let person = context.messages.person.content;

        let data = {
            lastName: person.lastName,
        };
        if (person.firstName) {
            data.firstName = person.firstName;
        }
        if (person.email) {
            data.contactInfo = {
                email: person.email
            };
        }
        if (person.phone) {
            data.contactInfo = data.contactInfo || {};
            data.contactInfo.tel1 = person.phone;
        }
        if (person.telType) {
            data.contactInfo = data.contactInfo || {};
            data.contactInfo.tel1Type = person.telType;
        }
        if (person.account) {
            data.relationship = {
                company: person.account
            };
            if (!person.position) {
                throw new context.CancelError('Missing position.');
            }
            data.relationship.type = person.position;
        }

        return commons.raynetAPI(context.auth, 'person', 'PUT', instanceName, data)
            .then(res => {
                const personId = res['data']['id'];
                return commons.raynetAPI(context.auth, 'person', 'GET', instanceName, {}, personId);
            })
            .then(res => {
                return context.sendJson(res['data'], 'newPerson');
            });
    }
};
