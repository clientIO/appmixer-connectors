'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const { withHeaders } = context.properties;

        const {
            fileId,
            delimiter = ',',
            row,
            rowWithColumns,
            parseNumbers,
            parseBooleans
        } = context.messages.in.content;

        const processor = new CSVProcessor(context, fileId, {
            withHeaders,
            delimiter,
            parseNumbers,
            parseBooleans
        });
        const savedFile = await processor.addRow({ row, rowWithColumns }, (idx, currentRow, isEndOfFile) => {
            return isEndOfFile;
        });

        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
