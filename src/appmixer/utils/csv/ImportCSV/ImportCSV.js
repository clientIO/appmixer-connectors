'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const { fileId, delimiter } = context.messages.in.content;
        const { filePickerFilename, filePickerContent } = context.properties;

        if (filePickerFilename) {
            // Component was called to save a file
            const file = await context.saveFileStream(filePickerFilename, Buffer.from(filePickerContent, 'utf8'));
            return context.sendJson({ fileId: file.metadata.fileId }, 'out');
        } else {
            // Triggered from flow
            const processor = new CSVProcessor(context, fileId, {
                withHeaders: true,
                delimiter
            });

            const objectHeaders = await CSVProcessor.getHeadersAsObject(processor);
            return context.sendJson({
                fileId,
                ...objectHeaders
            }, 'out');
        }
    }
};
