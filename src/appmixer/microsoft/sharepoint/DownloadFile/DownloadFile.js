const commons = require('../../microsoft-commons');

module.exports = {

    async receive(context) {

        const {
            driveId,
            itemId,
            itemPath,
            customFileName
        } = context.messages.in.content;

        const { profileInfo } = context.auth;

        const getFile = await commons.formatError(async () => {
            const endpoint = itemId ?
                `/drives/${driveId}/items/${itemId}` :
                `/drives/${driveId}/root:/${itemPath}`;

            const { data } = await commons.msGraphRequest(context, {
                action: endpoint + '?select=id,@microsoft.graph.downloadUrl,webUrl,name,folder'
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

        return context.sendJson(getFile, 'out');
    }
};
