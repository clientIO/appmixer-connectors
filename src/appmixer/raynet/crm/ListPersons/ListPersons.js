'use strict';
const commons = require('../../raynet-commons');

/**
 * Component for fetching list of persons
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return commons.getPersons({
            authOptions: context.auth,
            endpoint: 'person',
            method: 'GET',
            instanceName: context.auth.instanceName
        }).then(res => {
            return context.sendJson(res, 'persons');
        });
    }
};

