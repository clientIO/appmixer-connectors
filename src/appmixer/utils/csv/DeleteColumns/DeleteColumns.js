'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const { withHeaders } = context.properties;

        const {
            fileId,
            delimiter,
            columns,
            indexes
        } = context.messages.in.content;

        const processor = new CSVProcessor(context, fileId, {
            withHeaders,
            delimiter
        });

        const options = {
            columns,
            indexes
        };

        const savedFile = await processor.deleteColumns(options);
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
