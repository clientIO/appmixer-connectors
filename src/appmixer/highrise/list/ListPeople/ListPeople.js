'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Component for fetching list of people
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let getListPeople = Promise.promisify(client.people.get, { context: client.people });

        return getListPeople()
            .then(res => {
                return context.sendJson(res, 'people');
            });
    }
};

