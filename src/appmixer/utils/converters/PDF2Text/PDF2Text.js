'use strict';
const converters = require('../converters');
const path = require('path');
const { Readable } = require('stream');

module.exports = {

    async receive(context) {

        const { fileId, outputTextContent } = context.messages.in.content;
        const fileInfo = await context.getFileInfo(fileId);
        const newFileName = path.parse(fileInfo.filename).name + '.txt';
        const textContent = await converters.pdfToText(context, fileId);
        const savedFile = await context.saveFileStream(newFileName, Readable.from(textContent));
        const out = { ...savedFile };
        if (outputTextContent) {
            out.textContent = (await context.loadFile(savedFile.fileId)).toString('utf8');
        }
        return context.sendJson(out, 'out');
    }
};
