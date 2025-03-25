'use strict';
const converters = require('../converters');
const path = require('path');
const { Readable } = require('stream');

const MAX_PDF_FILE_SIZE = 1024 * 1024 * 10; // 10MB

module.exports = {

    async receive(context) {

        const { fileId, outputTextContent } = context.messages.in.content;
        const fileInfo = await context.getFileInfo(fileId);
        if (fileInfo.length > MAX_PDF_FILE_SIZE) {
            throw new context.CancelError(`PDF file is too large. Max file size is ${MAX_PDF_FILE_SIZE / 1024 / 1024}MB.`);
        }
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
