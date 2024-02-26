'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { query, searchType, folderLocation } = context.messages.in.content;

        let folderId;
        if (folderLocation) {
            if (typeof folderLocation === 'string') {
                folderId = folderLocation;
            } else {
                folderId = folderLocation.id;
            }
        }

        const queryParentsSuffix = folderLocation ? ` and '${folderId}' in parents` : '';
        const querySuffix = ' and trashed=false' + queryParentsSuffix;
        const queryFolderSuffix = ' and mimeType = \'application/vnd.google-apps.folder\'';
        const queryFileSuffix = ' and mimeType != \'application/vnd.google-apps.folder\'';

        let q;
        if (searchType === 'fileNameExact') {
            q = `name='${query}'` + querySuffix + queryFileSuffix;
        } else if (searchType === 'fileNameContains') {
            q = `name contains '${query}'` + querySuffix + queryFileSuffix;
        } else if (searchType === 'folderNameExact') {
            q = `name='${query}'` + querySuffix + queryFolderSuffix;
        } else if (searchType === 'folderNameContains') {
            q = `name contains '${query}'` + querySuffix + queryFolderSuffix;
        } else if (searchType === 'fullText') {
            q = `fullText contains '${query}'` + querySuffix;
        } else {
            q = query;  // no query suffix, this is a completely custom search.
        }

        await context.log({ q: q });

        const { data } = await drive.files.list({ q, fields: 'files(id, name, mimeType, webViewLink, createdTime)' });
        const { files = [] } = data;
        if (files.length > 0) {
            const file = files[0];
            return context.sendJson({
                googleId: file.id,
                fileName: file.name,
                mimeType: file.mimeType,
                webViewLink: file.webViewLink,
                createdTime: file.createdTime,
                isFolder: file.mimeType === 'application/vnd.google-apps.folder',
                isFile: file.mimeType !== 'application/vnd.google-apps.folder'
            }, 'out');

        }
        return context.sendJson({ query:query }, 'notFound');
    }
};
