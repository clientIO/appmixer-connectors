'use strict';
const commons = require('../salesforce-commons');

/**
 * Component for fetching list of leads
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const client = commons.getSalesforceAPI(context);

        return client.sobject('Lead').find()
            .then(res => {
                return context.sendJson(res, 'leads');
            });
    }
};
