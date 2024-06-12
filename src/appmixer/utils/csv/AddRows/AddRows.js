'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const {
            fileId,
            delimiter = ',',
            rows,
            parseNumbers,
            parseBooleans
        } = context.messages.in.content;

        let rowsArray = rows;
        if (typeof rows === 'string') {
            // Try to parse string as JSON.
            try {
                rowsArray = JSON.parse(rows);
            } catch (error) {
                throw new context.CancelError(
                    'Property \'rows\' should be array or well formed JSON array string. ' +
                    'In case of CSV string, use modifier \'Split\' to create an Array.',
                    error
                );
            }
        }

        // true if the first row represents column names (CSV header) and you want to use them to identify the columns
        const withHeaders = !Array.isArray(rowsArray[0]);

        const processor = new CSVProcessor(context, fileId, {
            withHeaders,
            delimiter,
            parseNumbers,
            parseBooleans
        });

        const savedFile = await processor.addRows({ rows: rowsArray });
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
