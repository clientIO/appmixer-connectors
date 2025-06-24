'use strict';

const lib = require('../../lib.generated');

module.exports = {

    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, {
                'id': { 'type': 'string', 'title': 'Form ID' },
                'name': { 'type': 'string', 'title': 'Form Name' },
                'mimeType': { 'type': 'string', 'title': 'MIME Type' },
                'webViewLink': { 'type': 'string', 'title': 'Web View Link' },
                'createdTime': { 'type': 'string', 'title': 'Created Time' },
                'modifiedTime': { 'type': 'string', 'title': 'Modified Time' },
                'ownedByMe': { 'type': 'boolean', 'title': 'Owned By Me' }
            }, { label: 'Forms', value: 'result' });
        }

        // Build query for Google Drive API to find Google Forms
        const query = 'mimeType=\'application/vnd.google-apps.form\'';

        // Build request parameters
        const params = {
            q: query,
            orderBy: 'modifiedTime desc',
            fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,webViewLink,ownedByMe)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        };

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v3/files',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: params
        });

        const forms = data.files || [];

        return lib.sendArrayOutput({ context, records: forms, outputType });
    }
};