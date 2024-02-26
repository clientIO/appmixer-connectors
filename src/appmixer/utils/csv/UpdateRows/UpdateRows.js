'use strict';
const { expressionTransformer, mapExpressionValues } = require('../helpers');
const CSVProcessor = require('../CSVProcessor');

module.exports = {

    async receive(context) {

        const { withHeaders } = context.properties;

        const {
            fileId,
            delimiter,
            filters,
            values,
            indexes,
            indexedValues,
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
                filter: expressionTransformer(filters),
                values: mapExpressionValues(expressionTransformer(values))
            };
        } else {
            options = {
                indexes,
                indexedValues: mapExpressionValues(expressionTransformer(indexedValues))
            };
        }

        const savedFile = await processor.updateRows(options);
        return context.sendJson({ fileId: savedFile.fileId }, 'fileId');
    }
};
