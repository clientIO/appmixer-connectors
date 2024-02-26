'use strict';
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const {
            fileId,
            delimiter,
            columnName,
            newColumnName
        } = context.messages.in.content;

        const processor = new CSVProcessor(context, fileId, {
            withHeaders: true,
            delimiter
        });

        const savedFile = await processor.renameColumn(columnName, newColumnName);
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
