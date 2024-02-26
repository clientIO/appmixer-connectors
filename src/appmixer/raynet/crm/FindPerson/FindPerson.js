'use strict';
const commons = require('../../raynet-commons');
const Promise = require('bluebird');

/**
 * FindPerson action.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const instanceName = context.auth.instanceName;
        const email = context.messages.query.content.email;

        return commons.getPersons({
            authOptions: context.auth,
            endpoint: 'person',
            method: 'GET',
            instanceName: context.auth.instanceName
        }).then(res => {
            const promises = [];
            res.forEach(value => {
                if (value['contactInfo']['email'] === email) {
                    const personId = value['id'];
                    promises.push(commons.raynetAPI(context.auth, 'person', 'GET', instanceName, {}, personId));
                }
            });
            return Promise.all(promises);
        }).then(response => {
            return Promise.map(response, item => {
                return context.sendJson(item['data'], 'person');
            });
        });
    }
};
