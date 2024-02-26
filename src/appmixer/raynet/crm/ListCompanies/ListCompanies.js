'use strict';
const commons = require('../../raynet-commons');

/**
 * Component for fetching list of companies.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return commons.getPersons({
            authOptions: context.auth,
            endpoint: 'company',
            method: 'GET',
            instanceName: context.auth.instanceName
        }).then(res => {
            return context.sendJson(res, 'companies');
        });
    }
};

