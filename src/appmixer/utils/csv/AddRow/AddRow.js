'use strict';
const CSVProcessor = require('../CSVProcessor');
const { expressionTransformer } = require('../helpers');

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

        await processor.loadHeaders();

        let rowAsArray;

        if (withHeaders) {
            const headers = processor.getHeaders();
            const parsed = expressionTransformer(rowWithColumns);
            rowAsArray = headers.map(item => '');
            parsed.forEach(item => {
                const idx = processor.getHeaderIndex(item.column);
                rowAsArray[idx] = item.value;
            });
        } else {
            rowAsArray = row.split(delimiter);
        }

        for (let i = 0; i < rowAsArray.length; i++) {
            const item = rowAsArray[i];
            if (item === undefined || item === null) {
                rowAsArray[i] = '';
            }
        }

        const savedFile = await processor.addRow(rowAsArray, (idx, currentRow, isEndOfFile) => {
            return isEndOfFile;
        });

        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
