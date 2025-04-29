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
            format,
            convertPdfFile
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
            if (convertPdfFile === 'txt') {
                // const fileinfo = await context.getFileInfo(getFile.fileId);
                // context.log({ step: 'fileInfo', fileinfo });
                const pdfjsLib = await import('pdfjs-dist');

                const fileData = await context.loadFile(getFile.fileId);
                context.log({ step: 'fileDataType', type: typeof (fileData) });

                const pdf = await pdfjsLib.getDocument({ data: fileData }).promise;

                context.log({ step: 'pdf data', pdf });

                let fullText = '';
                // for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                //     const page = await pdf.getPage(pageNum);
                //     const content = await page.getTextContent();
                //     const strings = content.items.map(item => item.str);
                //     fullText += strings.join(' ') + '\n\n';
                // }

                getFile.content = fullText;
            }
        }

        return context.sendJson(getFile, 'out');
    }
};
