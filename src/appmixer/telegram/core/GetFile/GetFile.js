'use strict';

const lib = require('../../lib');

module.exports = {

    async receive(context) {

        const { telegramFileId, fileName } = context.messages.in.content;

        if (!telegramFileId) {
            throw new context.CancelError('Telegram File ID is required!');
        }

        // getFile only returns metadata plus a temporary relative path; the bytes live on a
        // separate host and are fetched with the bot token in the URL.
        const file = await lib.apiRequest(context, 'getFile', { file_id: telegramFileId });

        if (!file || !file.file_path) {
            throw new context.CancelError(
                'Telegram returned no download path for this file. Files larger than 20MB cannot be '
                + 'downloaded through the Bot API.'
            );
        }

        const token = lib.getBotToken(context.auth);
        const downloadUrl = `${lib.API_BASE_URL}/file/bot${token}/${file.file_path}`;

        let response;

        try {
            // arraybuffer, not stream: saveFileStream takes a Buffer, and Telegram caps
            // Bot API downloads at 20MB, so holding the file in memory is bounded.
            response = await context.httpRequest({
                method: 'GET',
                url: downloadUrl,
                responseType: 'arraybuffer'
            });
        } catch (error) {
            // The download link expires - Telegram guarantees it for at least one hour -
            // so a stale file_path shows up here as a 404 rather than on getFile above.
            throw lib.normalizeError(context, error, 'file download');
        }

        // Telegram stores files under a type-prefixed path such as "documents/file_12.pdf";
        // the trailing segment is the only name it exposes.
        const resolvedName = fileName || file.file_path.split('/').pop() || telegramFileId;
        const savedFile = await context.saveFileStream(resolvedName, Buffer.from(response.data));

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName: resolvedName,
            filePath: file.file_path,
            fileSize: file.file_size || savedFile.length,
            telegramFileId
        }, 'out');
    }
};
