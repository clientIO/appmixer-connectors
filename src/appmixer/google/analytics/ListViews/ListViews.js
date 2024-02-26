'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of api function
const analytics = GoogleApi.analytics('v3');
const listViews = Promise.promisify(analytics.management.profiles.list,
    { context: analytics.management.profiles });

/**
 * This component lists all Views (profiles) user has access to.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return listViews({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            accountId: '~all',
            webPropertyId: '~all'
        }).then((data) => {
            return context.sendJson(data, 'out');
        });
    }
};
