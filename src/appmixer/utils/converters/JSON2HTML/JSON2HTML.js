'use strict';
const converters = require('../converters');
const path = require('path');

module.exports = {

    async receive(context) {

        const { fileId } = context.messages.in.content;
        const transformer = context.config.JSON2HTML_TRANSFORMER;

        const fileInfo = await context.getFileInfo(fileId);
        const newFileName = path.parse(fileInfo.filename).name + '.html';
        const savedFile = await converters.jsonToHtml(context, {
            sourceFileId: fileId,
            transformType: transformer,
            newFileName
        });

        return context.sendJson({
            fileId: savedFile.fileId,
            fileName: savedFile.filename
        }, 'out');
    }
};
