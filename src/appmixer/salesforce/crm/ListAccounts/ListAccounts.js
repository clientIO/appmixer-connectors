'use strict';
const commons = require('../salesforce-commons');

/**
 * Component for fetching list of accounts
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getSalesforceAPI(context);

        return client.sobject('Account').find()
            .then(res => {
                return context.sendJson(res, 'accounts');
            });

    }
};

