'use strict';
const commons = require('../../microsoft-commons');
const oneDriveAPI = require('onedrive-api');

module.exports = {

    async receive(context) {

        let { isToken, file } = context.messages.in.content;

        if (isToken) {
            return context.sendJson({
                clientId: context.auth.clientId,
                loginHint: context.auth.profileInfo.userPrincipalName
            }, 'out');
        }

        const { accessToken, profileInfo } = context.auth;

        // If the file is a string, it means it's an item ID that was provided dynamically.
        // Alternatively, it could be an object with an ID property. It's an object provided by OneDrive picker from the front-end.
        // Basically `file` is the same as `file.id` in this case.
        // We need to fetch the metadata of the item to get the download URL.
        if (typeof file === 'string' || (typeof file === 'object' && file.id)) {
            const itemId = typeof file === 'string' ? file : file.id;
            const data = await commons.formatError(() => {
                return oneDriveAPI.items.getMetadata({
                    accessToken,
                    itemId
                });
            }, `The selected file could not be found in your OneDrive account (${profileInfo.userPrincipalName})`);

            file = {
                id: data.id,
                name: data.name,
                mimeType: data.file.mimeType,
                downloadUrl: data['@microsoft.graph.downloadUrl'],
                size: data.size
            };
        }

        const { id, name, mimeType } = file;
        const response = await commons.formatError(() => {

            // Use the graph download URL if available to avoid using /content API.
            // See https://learn.microsoft.com/en-us/graph/api/driveitem-get-content?view=graph-rest-1.0&tabs=javascript#downloading-files-in-javascript-apps
            if (file.downloadUrl && file.size) {
                // This uses https://github.com/dkatavic/onedrive-api?tab=readme-ov-file#itemspartialdownload
                return oneDriveAPI.items.partialDownload({
                    accessToken,
                    bytesFrom: 0,
                    bytesTo: file.size - 1,
                    graphDownloadURL: file.downloadUrl
                });
            }

            // Fallback to /content API if download URL is not available.
            return oneDriveAPI.items.download({
                accessToken,
                itemId: id
            });
        }, `The selected file could not be found in your OneDrive account (${profileInfo.userPrincipalName})`);

        const download = response => {
            return new Promise((resolve, reject) => {
                const data = [];
                response
                    .on('end', () => resolve(Buffer.concat(data)))
                    .on('error', err => reject(err))
                    .on('data', d => data.push(d));
            });
        };
        const content = await download(response);

        const { fileId } = await context.saveFileStream(name, content);

        return context.sendJson({
            fileId,
            fileName: name,
            mimeType
        }, 'out');
    }
};
