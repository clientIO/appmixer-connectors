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

        // check if it withHeaders or not(if rows is an array of array string or array of objects)
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
