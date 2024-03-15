'use strict';

const { google } = require('googleapis');
const commons = require('../drive-commons');

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const auth = commons.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let { query, searchType, folderLocation, outputType } = context.messages.in.content;

        let folderId;
        if (folderLocation) {
            if (typeof folderLocation === 'string') {
                folderId = folderLocation;
            } else {
                folderId = folderLocation.id;
            }
        }

        const queryFolderSuffix = ' and mimeType = \'application/vnd.google-apps.folder\'';
        const queryFileSuffix = ' and mimeType != \'application/vnd.google-apps.folder\'';

        /** A query for filtering the file results. See https://developers.google.com/drive/api/v3/search-files for more info. */
        let q = `'${folderId}' in parents and trashed=false`;
        if (!query) {
            // no query, just list all files or folders in the parent folder.
        } else if (searchType === 'fileNameExact') {
            q += ` and name='${query}'` + queryFileSuffix;
        } else if (searchType === 'fileNameContains') {
            q += ` and name contains '${query}'` + queryFileSuffix;
        } else if (searchType === 'folderNameExact') {
            q += ` and name='${query}'` + queryFolderSuffix;
        } else if (searchType === 'folderNameContains') {
            q += ` and name contains '${query}'` + queryFolderSuffix;
        } else if (searchType === 'fullText') {
            q += ` and fullText contains '${query}'`;
        } else {
            q += ` and ${query}`;  // no query suffix, this is a completely custom search withinn the folder.
        }

        await context.log({ step: 'Preparing query parameter', q });
        const pageSize = 1000;
        const fields = 'nextPageToken, files(id, name, mimeType, webViewLink, createdTime)';
        // First page.
        const { data } = await drive.files.list({ q, pageSize, fields });

        // While there are more pages, keep fetching them.
        while (data.nextPageToken) {
            const nextPage = await drive.files.list({ q, pageToken: data.nextPageToken, pageSize, fields });
            data.files = data.files.concat(nextPage.data.files);
            data.nextPageToken = nextPage.data.nextPageToken;
        }

        const { files = [] } = data;
        if (outputType === 'item') {
            // One by one.
            await context.sendArray(files, 'out');
        } else if (outputType === 'items') {
            // All at once.
            await context.sendJson({ items: files }, 'out');
        } else if (outputType === 'file') {
            // Into CSV file.
            const headers = Object.keys(files[0]);
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const file of files) {
                const values = headers.map(header => {
                    const val = file[header];
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const savedFile = await context.saveFileStream(`google-drive-ListFiles-${folderId}.csv`, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;
        if (outputType === 'item') {
            let options = [
                { label: 'Id', value: 'id' },
                { label: 'Name', value: 'name' },
                { label: 'Mime Type', value: 'mimeType' },
                { label: 'Web View Link', value: 'webViewLink' },
                { label: 'Created Time', value: 'createdTime' }
            ];
            return context.sendJson(options, 'out');
        } else if (outputType === 'items') {
            return context.sendJson([{ label: 'Items', value: 'items' }], 'out');
        } else {        // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
