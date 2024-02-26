'use strict';
const oneDriveAPI = require('onedrive-api');
const commons = require('../../microsoft-commons');

const PAGE_SIZE = 100; // Number of items to retrieve per page

module.exports = {

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, context.messages.in.content.outputType);
        }

        const {
            driveId,
            siteId,
            groupId,
            userId,
            drive,
            itemId,
            itemPath,
            limit,
            outputType,
            select,
            orderby,
            filter
        } = context.messages.in.content;
        const { accessToken, profileInfo } = context.auth;
        const MAX_LIMIT = limit || 100;
        let files = [];
        let nextLink = null;
        let totalFiles = 0;
        const queryParameters = { select, orderby, filter, top: Math.min(PAGE_SIZE, MAX_LIMIT - totalFiles) };

        const query = Object.entries(queryParameters)
            .map(([key, value]) => value && `${key}=${value}`)
            .filter(Boolean)
            .join('&');

        do {
            const options = {
                accessToken,
                itemId,
                itemPath,
                drive,
                driveId: driveId || siteId || groupId || userId,
                skipToken: nextLink ? nextLink.split('?skiptoken=')[1] : null,
                query: `?${query}`
            };

            const result = await commons.formatError(async () => {
                return oneDriveAPI.items.listChildren(options);
            }, `Failed to list files in the folder "${itemId || itemPath}" from your OneDrive account (${profileInfo.userPrincipalName}).`);

            files = files.concat(result.value);
            nextLink = result['@odata.nextLink'];
            totalFiles += result.value.length;
        } while (nextLink && totalFiles < MAX_LIMIT);

        if (outputType === 'items') {
            return context.sendJson({ files }, 'out');
        }

        const headers = Object.keys(files[0] || {});
        const csvRows = [headers.map(label => this.convertToStartCase(label)).join(',')];

        for (const file of files) {
            if (outputType === 'item') {
                await context.sendJson(file, 'out');
            } else {
                const row = Object.values(file).join(',');
                csvRows.push(row);
            }
        }

        if (outputType === 'file') {
            const csvString = csvRows.join('\n');
            const buffer = Buffer.from(csvString, 'utf8');
            const filename = `onedrive-listfiles-${context.componentId}.csv`;
            const savedFile = await context.saveFileStream(filename, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson([
                { label: 'ID', value: 'id' },
                { label: 'Name', value: 'name' },
                { label: 'Created Date Time', value: 'createdDateTime' },
                { label: 'C Tag', value: 'cTag' },
                { label: 'E Tag', value: 'eTag' },
                { label: 'Last Modified Date Time', value: 'lastModifiedDateTime' },
                { label: 'Size', value: 'size' },
                { label: 'Web URL', value: 'webUrl' },
                { label: 'Created By User ID', value: 'createdBy.user.id' },
                { label: 'Created By User Display Name', value: 'createdBy.user.displayName' },
                { label: 'Last Modified By ID', value: 'lastModifiedBy.user.id' },
                { label: 'Last Modified By Display Name', value: 'lastModifiedBy.user.displayName' },
                { label: 'Parent Reference Drive ID', value: 'parentReference.driveId' },
                { label: 'Parent Reference Drive Type', value: 'parentReference.driveType' },
                { label: 'Parent Reference Drive Path', value: 'parentReference.path' }
            ], 'out');
        } else if (outputType === 'items') {
            return context.sendJson([
                {
                    label: 'Files',
                    value: 'files',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string', title: 'Id' },
                                name: { type: 'string', title: 'Name' },
                                createdDateTime: { type: 'string', title: 'Created Date Time' },
                                cTag: { type: 'string', title: 'C Tag' },
                                eTag: { type: 'string', title: 'E Tag' },
                                lastModifiedDateTime: { type: 'string', title: 'Last Modified Date Time' },
                                size: { type: 'string', title: 'Size' },
                                webUrl: { type: 'string', title: 'Web Url' },
                                createdByUserId: { type: 'string', title: 'Created By User Id' },
                                createdByUserDisplayName: { type: 'string', title: 'Created By User Display Name' },
                                lastModifiedByUserId: { type: 'string', title: 'Last Modified By User Id' },
                                lastModifiedByUserDisplayName:
                                { type: 'string', title: 'Last Modified By User Display Name' },
                                parentReferenceDriveId: { type: 'string', title: 'Parent Reference Drive Id' },
                                parentReferenceDriveType: { type: 'string', title: 'Parent Reference Drive Type' },
                                parentReferencePath: { type: 'string', title: 'Parent Reference Path' }
                            }
                        }
                    }
                }
            ], 'out');
        } else {
            // outputType === 'file'
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    },

    convertToStartCase(value) {
        return value.replace(/(^|[\s-_])(\w)/g, (match, space, letter) => {
            return space + letter.toUpperCase();
        });
    }
};
