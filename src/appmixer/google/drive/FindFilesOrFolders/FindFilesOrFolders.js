/* eslint-disable quotes */

'use strict';
const { google } = require('googleapis');
const lib = require('../lib');
const FILE_METADATA_SCHEMA = require('../file-metadata-schema.json');

// Shape of one emitted item (`item` / `firstItem` modes, and every entry of `items`).
const ITEM_SCHEMA = {
    type: 'object',
    required: ['isFile', 'isFolder', 'googleDriveFileMetadata'],
    properties: {
        index: { type: 'integer', title: 'Current Item Index', example: 0 },
        count: { type: 'integer', title: 'Items Count', example: 1 },
        isFile: { type: 'boolean', title: 'Is File', example: true },
        isFolder: { type: 'boolean', title: 'Is Folder', example: false },
        googleDriveFileMetadata: FILE_METADATA_SCHEMA
    }
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context);
        }

        const auth = lib.getOauth2Client(context.auth);
        const drive = google.drive({ version: 'v3', auth });
        let {
            query,
            searchType,
            folderLocation,
            recursive,
            fileTypes,
            orderBy,
            outputType
        } = context.messages.in.content;

        // Normalize fileTypes to ensure it's always an array
        fileTypes = lib.normalizeMultiselectInput(fileTypes);
        const escapedQuery = lib.escapeSpecialCharacters(query);

        let folderId;
        if (folderLocation) {
            folderId = typeof folderLocation === 'string' ? folderLocation : folderLocation.id;
        }

        const queryNonTrashedSuffix = 'trashed=false';
        const queryFolderSuffix = 'mimeType = \'application/vnd.google-apps.folder\'';
        const queryFileSuffix = 'mimeType != \'application/vnd.google-apps.folder\'';

        let q = [];
        if (searchType === 'fileNameExact') {
            q = [...(escapedQuery ? [`name='${escapedQuery}'`] : []), queryNonTrashedSuffix, queryFileSuffix];
        } else if (searchType === 'fileNameContains') {
            q = [...(escapedQuery ? [`name contains '${escapedQuery}'`] : []), queryNonTrashedSuffix, queryFileSuffix];
        } else if (searchType === 'folderNameExact') {
            q = [...(escapedQuery ? [`name='${escapedQuery}'`] : []), queryNonTrashedSuffix, queryFolderSuffix];
        } else if (searchType === 'folderNameContains') {
            q = [...(escapedQuery ? [`name contains '${escapedQuery}'`] : []), queryNonTrashedSuffix, queryFolderSuffix];
        } else if (searchType === 'fullText') {
            q = [...(escapedQuery ? [`fullText contains '${escapedQuery}'`] : []), queryNonTrashedSuffix];
        } else {
            // no query suffix, this is a completely custom search.
            q = [...(escapedQuery ? [escapedQuery] : [])];
        }

        if (fileTypes?.length) {
            const mimeTypeQuery = fileTypes.map(fileType => `mimeType contains '${fileType}'`).join(' or ');
            q.push(`(${mimeTypeQuery})`);
        }

        const orderByNormalized = searchType === 'fullText' ? null : orderBy;
        if (recursive && folderId) {
            // Find all subfolder IDs recursively.
            const subfolders = await lib.findSubfolders(context, drive, folderId, orderByNormalized);
            const subfolderIds = [folderId];
            for (let subfolder of subfolders) {
                subfolderIds.push(subfolder.googleDriveFileMetadata.id);
            }
            q.push(`(${subfolderIds.map(id => `'${id}' in parents`).join(' or ')})`);
        } else {
            if (folderId) {
                q.push(`'${folderId}' in parents`);
            }
        }

        const queryString = q.join(' and ');
        const items = await lib.findFiles(context, drive, queryString, orderByNormalized);
        if (items.length === 0) {
            return context.sendJson({ query }, 'notFound');
        }

        if (outputType === 'firstItem') {
            // First item only.
            if (items.length > 0) {
                return context.sendJson(items[0], 'out');
            }
        } else if (outputType === 'item') {
            // One by one.
            return context.sendArray(items, 'out');
        } else if (outputType === 'items') {
            // All at once.
            return context.sendJson({ items, count: items[0]?.count || 0 }, 'out');
        } else if (outputType === 'file') {
            // Into CSV file.
            // Expand objects first level (googleDriveFileMetadata) to columns.
            const firstItem = items[0];
            let headers = [];
            Object.keys(firstItem).map(key => {
                if (firstItem[key] && typeof firstItem[key] === 'object') {
                    headers = headers.concat(Object.keys(firstItem[key]).map(subKey => `${key}.${subKey}`));
                } else {
                    headers.push(key);
                }
            });
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const file of items) {
                const values = headers.map(header => {
                    let val;
                    if (header.includes('.')) {
                        const [key, subKey] = header.split('.');
                        val = file[key][subKey];
                    } else {
                        val = file[header];
                    }
                    if (typeof val === 'object' || Array.isArray(val)) {
                        val = JSON.stringify(val);
                    }
                    return `"${val}"`;
                });
                // To add ',' separator between each value
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const savedFile = await context.saveFileStream(`google-drive-FindFilesOrFolders-${(new Date).toISOString()}.csv`, buffer);
            return context.sendJson({ fileId: savedFile.fileId, count: items.count }, 'out');
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context) {

        const { outputType } = context.messages.in.content;
        // Leaf titles are prefixed "GDrive File.", the option itself keeps the label the static components use.
        const labels = { googleDriveFileMetadata: 'GDrive File Metadata' };
        const itemOptions = Object.entries(ITEM_SCHEMA.properties)
            .map(([value, schema]) => ({ label: labels[value] || schema.title, value, schema }));

        if (outputType === 'item' || outputType === 'firstItem') {
            return context.sendJson(itemOptions, 'out');
        } else if (outputType === 'items') {
            return context.sendJson([
                ITEM_SCHEMA.properties.count && { label: 'Items Count', value: 'count', schema: ITEM_SCHEMA.properties.count },
                { label: 'Items', value: 'items', schema: { type: 'array', items: ITEM_SCHEMA } }
            ], 'out');
        } else {        // file
            return context.sendJson([
                { label: 'Items Count', value: 'count', schema: ITEM_SCHEMA.properties.count },
                { label: 'File ID', value: 'fileId', schema: { type: 'string', format: 'appmixer-file-id', example: '64f1c2e8a1b2c3d4e5f60718' } }
            ], 'out');
        }
    }
};
