'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const { withHeaders } = context.properties;

        const {
            fileId,
            delimiter,
            columnName,
            defaultValue,
            insertMode,
            positioningColumn,
            index,
            parseNumbers,
            parseBooleans
        } = context.messages.in.content;

        const processor = new CSVProcessor(context, fileId, {
            withHeaders,
            delimiter,
            parseNumbers,
            parseBooleans
        });

        const options = {
            defaultValue: defaultValue || ''
        };

        options.positioningMethod = insertMode;

        if (withHeaders) {
            options.name = columnName;
            options.positioningColumn = positioningColumn;
        } else {
            options.index = index;
        }

        const savedFile = await processor.addColumn(options);
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
