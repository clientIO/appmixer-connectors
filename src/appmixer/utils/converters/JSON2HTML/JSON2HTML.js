'use strict';
const converters = require('../converters');
const path = require('path');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const transformer = context.config.JSON2HTML_TRANSFORMER;

        const fileInfo = await context.getFileInfo(fileId);
        const newFileName = path.parse(fileInfo.filename).name + '.html';
        const stream = await converters.jsonToHtml(context, fileId, transformer);
        const savedFile = await context.saveFileStream(newFileName, stream);

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName: savedFile.filename
        }, 'out');
    }
};
