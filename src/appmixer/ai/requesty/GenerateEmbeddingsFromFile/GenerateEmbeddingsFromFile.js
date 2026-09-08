'use strict';

const { Transform } = require('stream');
const lib = require('../lib');

const FILE_PART_SIZE = 1024 * 1024; // 1MB

module.exports = {

    async receive(context) {

        const {
            fileId,
            model,
            chunkSize = 500,
            chunkOverlap = 50
        } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!fileId) {
            throw new context.CancelError('File ID is required!');
        }

        const readStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        await context.log({
            step: 'split-file',
            message: 'Splitting file into parts.',
            partSize: FILE_PART_SIZE,
            fileInfo
        });

        // The first vector of the whole file, repeated on every emitted message so that the
        // output shape stays identical to GenerateEmbeddings.
        let firstVector = null;

        for await (const part of splitStream(readStream, FILE_PART_SIZE)) {

            const embeddings = await lib.generateEmbeddings(context, {
                text: part.toString(),
                model,
                chunkSize,
                chunkOverlap
            });

            if (!embeddings.length) {
                continue;
            }
            if (!firstVector) {
                firstVector = embeddings[0].vector;
            }

            await context.sendJson({ embeddings, firstVector }, 'out');
        }
    }
};

/**
 * Splits a readable stream into chunks of n bytes.
 * @param {Readable} inputStream - The readable stream to split.
 * @param {number} chunkSize - Size of each chunk in bytes.
 * @returns {Readable} - A readable stream emitting chunks.
 */
function splitStream(inputStream, chunkSize) {

    let leftover = Buffer.alloc(0);

    const transformStream = new Transform({
        transform(chunk, encoding, callback) {
            // Combine leftover buffer with the new chunk.
            const combined = Buffer.concat([leftover, chunk]);
            const combinedLength = combined.length;

            // Emit chunks of the desired size.
            let offset = 0;
            while (offset + chunkSize <= combinedLength) {
                this.push(combined.subarray(offset, offset + chunkSize));
                offset += chunkSize;
            }

            // Store leftover data.
            leftover = combined.subarray(offset);

            callback();
        },
        flush(callback) {
            // Push any remaining data as the final chunk.
            if (leftover.length > 0) {
                this.push(leftover);
            }
            callback();
        }
    });

    return inputStream.pipe(transformStream);
}
