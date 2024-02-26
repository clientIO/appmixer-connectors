'use strict';
const { expressionTransformer } = require('../helpers');
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const { withHeaders } = context.properties;

        const {
            fileId,
            delimiter,
            filters,
            indexes,
            parseNumbers,
            parseBooleans
        } = context.messages.in.content;


        const processor = new CSVProcessor(context, fileId, {
            withHeaders,
            delimiter,
            parseNumbers,
            parseBooleans
        });

        let options;

        if (withHeaders) {
            options = {
                filters: expressionTransformer(filters)
            };
        } else {
            options = {
                indexExpression: indexes
            };
        }

        const savedFile = await processor.deleteRows(options);
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
