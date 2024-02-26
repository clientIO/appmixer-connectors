'use strict';
const request = require('request');
const Promise = require('bluebird');

/**
 * Component for fetching list of companies of an account
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let getCompanies = Promise.promisify(request.get, { context: request });

        return getCompanies(
            'https://launchpad.37signals.com/authorization.json',
            {
                'auth': {
                    'bearer': context.auth.accessToken
                }
            })
            .then(res => {
                if (res['statusCode'] === 200) {
                    return context.sendJson(JSON.parse(res['body'])['accounts'], 'companies');
                } else {
                    throw new Error(res);
                }
            });
    }
};

