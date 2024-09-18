'use strict';
const converters = require('../converters');
const path = require('path');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;

        const fileInfo = await context.getFileInfo(fileId);
        const newFileName = path.parse(fileInfo.filename).name + '.csv';
        const savedFile = await converters.jsonToCsv(context, { sourceFileId: fileId, newFileName, jsonPath: '*' });

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName: savedFile.filename
        }, 'out');
    }
};
