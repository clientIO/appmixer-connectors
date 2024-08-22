const { pipeline } = require('stream');
const customHtmlTransforms = require('./htmlTransforms');
const JSONStream = require('JSONStream');
const {
    getCSVReadStream,
    csvToJsonTransform,
    jsonToCsvTransform
} = require('./csvTransforms');

module.exports = {

    csvToJson: async function(context, sourceFileId) {

        const readStream = await context.getFileReadStream(sourceFileId);
        const csvStream = getCSVReadStream();

        return pipeline(
            readStream,
            csvStream,
            csvToJsonTransform(),
            () => {
                // noop - error is handled by the caller
            }
        );
    },

    csvToHtml: async function(context, sourceFileId, transformType = 'table') {

        const readStream = await context.getFileReadStream(sourceFileId);
        const csvStream = getCSVReadStream();
        const transformer = customHtmlTransforms[transformType];

        if (!transformer) {
            throw new context.CancelError(`HTML transformer '${transformType}' is not defined. Available transformers: ${Object.keys(customHtmlTransforms).join(',')}`);
        }

        return pipeline(
            readStream,
            csvStream,
            transformer.transform(),
            () => {
                // noop - error is handled by the caller
            }
        );
    },

    jsonToHtml: async function(context, sourceFileId, transformType = 'table') {

        const readStream = await context.getFileReadStream(sourceFileId);
        const transformer = customHtmlTransforms[transformType];

        if (!transformer) {
            throw new context.CancelError(`HTML transformer '${transformType}' is not defined. Available transformers: ${Object.keys(customHtmlTransforms).join(',')}`);
        }

        return pipeline(
            readStream,
            JSONStream.parse(transformer.jsonPath),
            transformer.transform(),
            () => {
                // noop - error is handled by the caller
            }
        );
    },

    jsonToCsv: async function(context, sourceFileId, jsonPath = '*') {

        const readStream = await context.getFileReadStream(sourceFileId);

        return pipeline(
            readStream,
            JSONStream.parse(jsonPath),
            jsonToCsvTransform(),
            () => {
                // noop - error is handled by the caller
            }
        );
    }
};
