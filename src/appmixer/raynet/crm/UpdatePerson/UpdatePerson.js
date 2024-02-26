'use strict';
const commons = require('../../raynet-commons');

/**
 * Update person in Raynet.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const instanceName = context.auth.instanceName;
        const person = context.messages.person.content;
        const personId = person.personId;
        delete person['personId'];
        const data = {
            lastName: person.lastName,
            firstName: person.firstName,
            contactInfo: {
                email: person.email,
                tel1: person.phone,
                tel1Type: person.telType
            },
            relationship: {
                company: person.account,
                type: person.position
            }
        };

        return commons.raynetAPI(context.auth, 'person', 'POST', instanceName, data, personId)
            .then(() => {
                return commons.raynetAPI(context.auth, 'person', 'GET', instanceName, {}, personId);
            })
            .then(res => {
                return context.sendJson(res['data'], 'updatedPerson');
            });
    }
};

