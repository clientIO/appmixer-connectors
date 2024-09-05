const { pipeline } = require('stream');
const customHtmlTransforms = require('./htmlTransforms');
const JSONStream = require('JSONStream');
const {
    getCSVReadStream,
    csvToJsonTransform,
    jsonToCsvTransform
} = require('./csvTransforms');

module.exports = {

    csvToJson: async function(context, { sourceFileId, newFileName }) {

        const readStream = await context.getFileReadStream(sourceFileId);
        const csvStream = getCSVReadStream();

        return new Promise((resolve, reject) => {
            const stream = pipeline(
                readStream,
                csvStream,
                csvToJsonTransform(),
                (e) => {
                    if (e) reject(e);
                }
            );
            context.saveFileStream(newFileName, stream)
                .then(resolve)
                .catch(reject);
        });
    },

    csvToHtml: async function(context, { sourceFileId, transformType = 'table', newFileName }) {

        const readStream = await context.getFileReadStream(sourceFileId);
        const csvStream = getCSVReadStream();
        const transformer = customHtmlTransforms[transformType];

        if (!transformer) {
            throw new context.CancelError(`HTML transformer '${transformType}' is not defined. Available transformers: ${Object.keys(customHtmlTransforms).join(',')}`);
        }

        return new Promise((resolve, reject) => {
            const stream = pipeline(
                readStream,
                csvStream,
                transformer.transform(),
                (e) => {
                    if (e) reject(e);
                }
            );
            context.saveFileStream(newFileName, stream)
                .then(resolve)
                .catch(reject);
        });
    },

    jsonToHtml: async function(context, { sourceFileId, transformType = 'table', newFileName }) {

        const readStream = await context.getFileReadStream(sourceFileId);
        const transformer = customHtmlTransforms[transformType];

        if (!transformer) {
            throw new context.CancelError(`HTML transformer '${transformType}' is not defined. Available transformers: ${Object.keys(customHtmlTransforms).join(',')}`);
        }

        return new Promise((resolve, reject) => {
            const stream = pipeline(
                readStream,
                JSONStream.parse(transformer.jsonPath),
                transformer.transform(),
                (e) => {
                    if (e) reject(e);
                }
            );
            context.saveFileStream(newFileName, stream)
                .then(resolve)
                .catch(reject);
        });
    },

    jsonToCsv: async function(context, { sourceFileId, jsonPath = '*', newFileName }) {

        const readStream = await context.getFileReadStream(sourceFileId);

        return new Promise((resolve, reject) => {
            const stream = pipeline(
                readStream,
                JSONStream.parse(jsonPath),
                jsonToCsvTransform(),
                (e) => {
                    if (e) reject(e);
                }
            );
            context.saveFileStream(newFileName, stream)
                .then(resolve)
                .catch(reject);
        });
    }
};
