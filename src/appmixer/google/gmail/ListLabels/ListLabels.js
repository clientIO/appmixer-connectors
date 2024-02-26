'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const { promisify } = require('util');

// GoogleApi initialization & promisify of some api function for convenience
const gmail = GoogleApi.gmail('v1');

module.exports = {
    async receive(context) {

        const listLabel = promisify(gmail.users.labels.list.bind(gmail.users.labels.list));
        const { labels} = await listLabel({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId
        });
        return context.sendJson(labels, 'out');
    },

    labelsToSelectArray (labels) {

        let transformed = [];
    
        if (Array.isArray(labels)) {
            labels.forEach(label => {
                let item = {
                    label: label.name,
                    value: label.id
                };
                transformed.push(item);
            });
        }
        return transformed;
    }
};
