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
        if (typeof file === 'string') {
            const data = await commons.formatError(() => {
                return oneDriveAPI.items.getMetadata({
                    accessToken,
                    itemId: file
                });
            }, `The selected file could not be found in your OneDrive account (${profileInfo.userPrincipalName})`);

            file = {
                id: data.id,
                name: data.name,
                mimeType: data.file.mimeType
            };
        }

        const { id, name, mimeType } = file;
        const response = await commons.formatError(() => {
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
