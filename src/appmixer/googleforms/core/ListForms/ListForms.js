'use strict';

module.exports = {

    async receive(context) {
        const { pageSize = 100, pageToken, orderBy = 'modifiedTime desc', searchQuery } = context.messages.in.content;

        // Validate page size
        const validPageSize = Math.min(Math.max(1, pageSize), 1000);

        // Build query for Google Drive API to find Google Forms
        let query = 'mimeType=\'application/vnd.google-apps.form\'';

        // Add search query if provided
        if (searchQuery) {
            query += ` and name contains '${searchQuery.replace(/'/g, '\\\'')}'`;
        }

        // Build request parameters
        const params = {
            q: query,
            pageSize: validPageSize,
            orderBy: orderBy,
            fields: 'nextPageToken,files(id,name,mimeType,createdTime,modifiedTime,webViewLink,iconLink,thumbnailLink,owners,lastModifyingUser,shared,ownedByMe,capabilities)',
            supportsAllDrives: true,
            includeItemsFromAllDrives: true
        };

        if (pageToken) {
            params.pageToken = pageToken;
        }

        const { data } = await context.httpRequest({
            method: 'GET',
            url: 'https://www.googleapis.com/drive/v3/files',
            headers: {
                'Authorization': `Bearer ${context.auth.accessToken}`
            },
            params: params
        });

        // Calculate total forms and whether there are more pages
        const forms = response.files || [];
        const hasMorePages = !!response.nextPageToken;

        return context.sendJson({
            forms: forms,
            nextPageToken: response.nextPageToken || null,
            totalForms: forms.length,
            hasMorePages: hasMorePages
        }, 'out');
    }
};