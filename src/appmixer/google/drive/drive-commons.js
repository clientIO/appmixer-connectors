const { google } = require('googleapis');

let defaultExportFormats = {
    'application/vnd.google-apps.site': {
        extension: 'zip',
        mimeType: 'application/zip'
    },
    'application/vnd.google-apps.document': {
        extension: 'docx',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    },
    'application/vnd.google-apps.spreadsheet': {
        extension: 'xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    },
    'application/vnd.google-apps.presentation': {
        extension: 'pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    },
    'application/vnd.google-apps.drawing': {
        extension: 'png',
        mimeType: 'image/png'
    }
};

const processedItemsBuffer = function(data = []) {

    const MAX_GROUP_COUNT = 3;
    return {
        has(id) {
            return data.find(group => group.ids[id]);
        },
        add(group, id) {
            const groupData = data.find(groupData => groupData.group === group);
            if (!groupData) {
                const ids = {};
                ids[id] = true;
                data.push({ group, ids });
            } else {
                groupData.ids[id] = true;
            }
        },
        export() {
            return data.slice(-MAX_GROUP_COUNT);
        }
    };
};

module.exports = {

    processedItemsBuffer,
    defaultExportFormats,

    getOauth2Client(auth) {

        const { clientId, clientSecret, accessToken } = auth;
        let OAuth2 = google.auth.OAuth2;
        let oauth2Client = new OAuth2({
            clientId,
            clientSecret
        });

        oauth2Client.setCredentials({
            'access_token': accessToken
        });

        return oauth2Client;
    },

    getCredentials(credentials) {
        return {
            accessToken: credentials.accessToken,
            expiryDate: credentials.expDate
        };
    },

    isDebug(context) {
        return context.config.DEBUG === 'true' || false;
    }
};
