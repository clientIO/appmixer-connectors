'use strict';
const merk = require('../../merk-commons');
const Promise = require('bluebird');

module.exports = {

    receive(context) {

        return merk.get(
            '/company/',
            context.auth.apiKey,
            context.messages.query.content
        ).then(companies => {
            return Promise.map(companies, company => {
                return context.sendJson(company, 'company');
            });
        });
    }
};
