'use strict';

const { Transform } = require('stream');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

// See https://docs.voyageai.com/reference/embeddings-api
const MAX_INPUT_LENGTH = 8192 * 4; // max 8192 tokens, 1 token ~ 4 characters.
const MAX_BATCH_SIZE = 2048;
const FILE_PART_SIZE = 1024 * 1024; // 1MB

module.exports = {

    receive: async function(context) {

        const {
            fileId,
            model = 'voyage-2',
            chunkSize = 500,
            chunkOverlap = 50
        } = context.messages.in.content;

        const apiKey = context.auth.apiKey;
        const readStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        await context.log({ step: 'split-file', message: 'Splitting file into parts.', partSize: FILE_PART_SIZE, fileInfo });
        let firstVector = null;
        const partsStream = splitStream(readStream, FILE_PART_SIZE);
        for await (const part of partsStream) {
            const text = part.toString();
            const chunks = await this.splitText(text, chunkSize, chunkOverlap);
            await context.log({ step: 'split-text', message: 'Text split into chunks.', chunksLength: chunks.length, textLength: text.length });
            const batchSize = Math.min(Math.floor((MAX_INPUT_LENGTH / 2) / chunkSize), MAX_BATCH_SIZE);
            const embeddings = [];
            for (let i = 0; i < chunks.length; i += batchSize) {
                const batch = chunks.slice(i, i + batchSize);
                const response = await context.httpRequest.post(
                    'https://api.voyageai.com/v1/embeddings',
                    { model, input: batch },
                    { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
                );
                (response.data.data || []).forEach((item, index) => {
                    if (!firstVector) firstVector = item.embedding;
                    embeddings.push({ text: batch[index], vector: item.embedding, index: i + index });
                });
            }
            await context.sendJson({ embeddings, firstVector }, 'out');
        }
    },

    splitText(text, chunkSize, chunkOverlap) {
        const splitter = new RecursiveCharacterTextSplitter({ chunkSize, chunkOverlap });
        return splitter.splitText(text);
    }
};

function splitStream(inputStream, chunkSize) {
    let leftover = Buffer.alloc(0);
    const transformStream = new Transform({
        transform(chunk, encoding, callback) {
            const combined = Buffer.concat([leftover, chunk]);
            const combinedLength = combined.length;
            let offset = 0;
            while (offset + chunkSize <= combinedLength) {
                this.push(combined.slice(offset, offset + chunkSize));
                offset += chunkSize;
            }
            leftover = combined.slice(offset);
            callback();
        },
        flush(callback) {
            if (leftover.length > 0) {
                this.push(leftover);
            }
            callback();
        }
    });
    return inputStream.pipe(transformStream);
}
