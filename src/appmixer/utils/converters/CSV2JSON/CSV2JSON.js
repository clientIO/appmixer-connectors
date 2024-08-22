'use strict';
const converters = require('../converters');
const path = require('path');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;

        const fileInfo = await context.getFileInfo(fileId);
        const newFileName = path.parse(fileInfo.filename).name + '.json';
        const stream = await converters.csvToJson(context, fileId);
        const savedFile = await context.saveFileStream(newFileName, stream);

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName: savedFile.filename
        }, 'out');
    }
};
