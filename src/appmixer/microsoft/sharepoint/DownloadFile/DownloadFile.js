const commons = require('../../microsoft-commons');

module.exports = {

    async receive(context) {

        const {
            driveId,
            itemId,
            itemPath,
            customFileName,
            outputFileData,
            outputFileDataEncoding,
            format
        } = context.messages.in.content;

        const { profileInfo } = context.auth;
        context.log({ step: 'AUTH', auth: context.auth });

        const getFile = await commons.formatError(async () => {
            if (format) {
                const downloadUrl = itemId ?
                    `/drives/${driveId}/items/${itemId}/content?format=${format}` :
                    `/drives/${driveId}/root:/${itemPath}:/content?format=${format}`;

                const { data: stream } = await commons.msGraphRequest(context, {
                    action: downloadUrl,
                    responseType: 'stream'
                });

                const fileName = customFileName ? `${customFileName}.${format}` : `sharepoint-download-file.${format}`;
                return await context.saveFileStream(fileName, stream);
            }
            const endpoint = itemId ?
                `/drives/${driveId}/items/${itemId}` :
                `/drives/${driveId}/root:/${itemPath}`;

            endpoint += '?select=id,@microsoft.graph.downloadUrl,webUrl,name,folder';


            context.log({ step: 'endpoint called', endpoint });
            const { data } = await commons.msGraphRequest(context, {
                action: endpoint
            });

            const downloadUrl = data['@microsoft.graph.downloadUrl'];

            if (!downloadUrl) {
                if (data?.folder) {
                    throw new context.CancelError('Cannot download a folder.', data);
                }
                throw new context.CancelError('The file does not have a download URL.', data);
            }

            const { data: stream } = await commons.msGraphRequest(context, {
                action: downloadUrl,
                responseType: 'stream'
            });

            const fileName = customFileName || `sharepoint-download-file-${data.id}`;
            return await context.saveFileStream(fileName, stream);

        }, `Failed to get the file "${itemId || itemPath}" from your SharePoint account (${profileInfo.userPrincipalName}).`);

        if (outputFileData) {
            getFile.content = (await context.loadFile(getFile.fileId)).toString(outputFileDataEncoding || 'utf8');
        }

        return context.sendJson(getFile, 'out');
    }
};
