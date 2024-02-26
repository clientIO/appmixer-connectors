'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Component for fetching task categories
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let getListCategories = Promise.promisify(client.categories.get, { context: client.categories });

        return getListCategories(
            'task'
        ).then(res => {
            return context.sendJson(res, 'categories');
        });
    }
};

