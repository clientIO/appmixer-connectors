'use strict';
const CSVProcessor = require('../CSVProcessor');
const { convertRowWithColumnsToObject } = require('../helpers');

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
        const savedFile = await processor.addRows(
            { rows: withHeaders ? [convertRowWithColumnsToObject(rowWithColumns)] : row.split(delimiter) },
            (idx, currentRow, isEndOfFile) => {
                return isEndOfFile;
            }
        );
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
