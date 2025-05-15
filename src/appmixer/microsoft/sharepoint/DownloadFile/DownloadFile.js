const commons = require('../../microsoft-commons');
const { pdfToText } = require('../lib');

const MAX_FILE_SIZE = 1024 * 1024 * 10; // 10MB

module.exports = {

    async receive(context) {

        const {
            itemId,
            itemPath,
            outputFileData,
            outputFileDataEncoding,
            format
        } = context.messages.in.content;

        const { profileInfo } = context.auth;

        const getFile = await commons.formatError(async () => {
            return format ? await downloadFileAndConvert(context, format) : await downloadFile(context);
        }, `Failed to get the file "${itemId || itemPath}" from your SharePoint account (${profileInfo.userPrincipalName}).`);

        if (outputFileData) {
            if (getFile.length > MAX_FILE_SIZE) {
                throw new context.CancelError(`File is too large. Max file size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            }
            getFile.content = (await context.loadFile(getFile.fileId)).toString(outputFileDataEncoding || 'utf8');
        }

        return context.sendJson(getFile, 'out');
    }
};

const downloadFile = async (context) => {
    const {
        driveId,
        itemId,
        itemPath,
        customFileName
    } = context.messages.in.content;

    let endpoint = itemId ?
        `/drives/${driveId}/items/${itemId}` :
        `/drives/${driveId}/root:/${itemPath}`;

    endpoint += '?select=id,@microsoft.graph.downloadUrl,webUrl,name,folder';

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
};

const downloadFileAndConvert = async (context, format) => {
    const {
        driveId,
        itemId,
        itemPath,
        customFileName
    } = context.messages.in.content;

    let downloadUrl;

    switch (format) {
        case 'txt': {
            const metaEndpoint = itemId
                ? `/drives/${driveId}/items/${itemId}`
                : `/drives/${driveId}/root:/${itemPath}`;

            const { data: meta } = await commons.msGraphRequest(context, {
                action: metaEndpoint + '?select=id,@microsoft.graph.downloadUrl,webUrl,name,folder,size,file'
            });

            if (meta.size > MAX_FILE_SIZE) {
                throw new context.CancelError(`File is too large. Max file size is ${MAX_FILE_SIZE / 1024 / 1024}MB.`);
            }

            // If the file is already PDF and we try to format it to PDF, it returns error 406
            if (meta.file.mimeType === 'application/pdf') {
                downloadUrl = meta['@microsoft.graph.downloadUrl'];

                if (!downloadUrl) {
                    if (meta?.folder) {
                        throw new context.CancelError('Cannot download a folder.', meta);
                    }
                    throw new context.CancelError('The file does not have a download URL.', meta);
                }
                break;
            } else {
                downloadUrl = itemId ?
                    `/drives/${driveId}/items/${itemId}/content?format=pdf` :
                    `/drives/${driveId}/root:/${itemPath}:/content?format=pdf`;
                break;
            }
        }
        case 'pdf':
        case 'html': {
            downloadUrl = itemId ?
                `/drives/${driveId}/items/${itemId}/content?format=${format}` :
                `/drives/${driveId}/root:/${itemPath}:/content?format=${format}`;
            break;
        }
        default: {
            throw new context.CancelError(`Could not determine download URL for the specified format: ${format}`);
        }
    }

    const { data: stream } = await commons.msGraphRequest(context, {
        action: downloadUrl,
        responseType: 'stream'
    });

    const fileName = customFileName ? `${customFileName}.${format}` : `sharepoint-download-file.${format}`;

    let fullText = '';
    if (format === 'txt') {
        fullText = await pdfToText(stream);
    }

    return await context.saveFileStream(fileName, fullText || stream);
};
