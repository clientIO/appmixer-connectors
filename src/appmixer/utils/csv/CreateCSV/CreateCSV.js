'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const { filename, initialContent } = context.messages.in.content;

        const content = initialContent || '';
        const savedFile = await context.saveFileStream(filename, content);

        const processor = new CSVProcessor(context, savedFile.fileId.toString(), {
            withHeaders: true
        });

        const objectHeaders = await CSVProcessor.getHeadersAsObject(processor);

        return context.sendJson({
            fileId: savedFile.metadata.fileId,
            ...objectHeaders
        }, 'out');
    }
};
