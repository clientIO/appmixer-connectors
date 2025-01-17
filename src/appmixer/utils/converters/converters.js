const { pipeline, Readable } = require('stream');
const customHtmlTransforms = require('./htmlTransforms');
const JSONStream = require('JSONStream');
const { arrayBuffer } = require('node:stream/consumers');
let pdfjslib;
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
    },

    pdfToText: async function(context, sourceFileId) {

        if (!pdfjslib) {
            pdfjslib = await import('pdfjs-dist/legacy/build/pdf.mjs');
        }
        const readStream = await context.getFileReadStream(sourceFileId);
        let text = '';
        // Unfortunately, `data` can only be a string, buffer or TypedArray.
        // getDocument() does not work over streams.
        const loadingTask = pdfjslib.getDocument({ data: await arrayBuffer(readStream) });
        const pdfDoc = await loadingTask.promise;
        for (let i = 0; i < pdfDoc.numPages; i++) {
            const page = await pdfDoc.getPage(i + 1);
            const textContent = await page.getTextContent();
            if (textContent.items.length) {
                text += textContent.items.map(item => item.str || '').join(' ');
            }
        }
        return text;
    }
};
