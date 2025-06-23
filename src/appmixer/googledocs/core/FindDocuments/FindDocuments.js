'use strict';

const lib = require('../../lib.generated');
const schema = { 
    'id': { 'type': 'string', 'title': 'Id' },
    'name': { 'type': 'string', 'title': 'Name' },
    'mimeType': { 'type': 'string', 'title': 'MIME Type' },
    'createdTime': { 'type': 'string', 'title': 'Created Time' },
    'modifiedTime': { 'type': 'string', 'title': 'Modified Time' },
    'webViewLink': { 'type': 'string', 'title': 'Web View Link' }
};

module.exports = {
    async receive(context) {

        const { query, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'files', value: 'files' });
        }

        // Build query parameter for Google Drive API to filter for Google Docs
        let q = "mimeType='application/vnd.google-apps.document'";
        if (query) {
            q += ` and name contains '${query.replace(/'/g, "\\'")}'`;
        }

        // https://developers.google.com/drive/api/v3/reference/files/list
        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v3/files',
            params: {
                q: q,
                fields: 'files(id,name,mimeType,createdTime,modifiedTime,webViewLink)',
                pageSize: 100
            },
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            }
        });

        const records = data.files || [];
        return lib.sendArrayOutput({ context, records, outputType });
    }
};
