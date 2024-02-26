'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of api function
const analytics = GoogleApi.analytics('v3');
const listWebProperties = Promise.promisify(analytics.management.webproperties.list,
    { context: analytics.management.webproperties });

/**
 * This component lists all Web Properties (Views) user has access to.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return listWebProperties({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            accountId: '~all'
        }).then((data) => {
            return context.sendJson(data, 'out');
        });
    }
};
