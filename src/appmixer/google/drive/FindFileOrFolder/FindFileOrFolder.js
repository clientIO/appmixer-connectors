'use strict';
const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { query, searchType, folderLocation, fileTypes } = context.messages.in.content;
        const escapedQuery = commons.escapeSpecialCharacters(query);

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
            q = `name='${escapedQuery}'` + querySuffix + queryFileSuffix;
        } else if (searchType === 'fileNameContains') {
            q = `name contains '${escapedQuery}'` + querySuffix + queryFileSuffix;
        } else if (searchType === 'folderNameExact') {
            q = `name='${escapedQuery}'` + querySuffix + queryFolderSuffix;
        } else if (searchType === 'folderNameContains') {
            q = `name contains '${escapedQuery}'` + querySuffix + queryFolderSuffix;
        } else if (searchType === 'fullText') {
            q = `fullText contains '${escapedQuery}'` + querySuffix;
        } else {
            q = query;  // no query suffix, this is a completely custom search.
        }

        if (fileTypes && fileTypes.length) {
            const mimeTypeQuery = fileTypes.map(fileType => `mimeType contains '${fileType}'`).join(' or ');
            q += ` and (${mimeTypeQuery})`;
        }

        await context.log({ step: 'query', q: q });

        const { data } = await drive.files.list({ q, fields: '*', pageSize: 1 });
        const { files = [] } = data;
        if (files.length > 0) {
            const file = files[0];
            return context.sendJson({
                isFolder: file.mimeType === 'application/vnd.google-apps.folder',
                isFile: file.mimeType !== 'application/vnd.google-apps.folder',
                googleDriveFileMetadata: file,
                // The fields below are for backward compatibility with the old implementation.
                // The above googleDriveFileMetadata field should be used instead.
                googleId: file.id,
                fileName: file.name,
                mimeType: file.mimeType,
                webViewLink: file.webViewLink,
                createdTime: file.createdTime
            }, 'out');

        }
        return context.sendJson({ query }, 'notFound');
    }
};
