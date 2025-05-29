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

        const rows = withHeaders
            ? [convertRowWithColumnsToObject(rowWithColumns)]
            : [Array.isArray(row) ? row : row.split(delimiter)];
        const savedFile = await processor.addRows({ rows });
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
