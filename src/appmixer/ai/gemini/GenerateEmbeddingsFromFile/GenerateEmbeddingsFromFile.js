'use strict';

const { OpenAI }  = require('openai');

// See https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-input.
const MAX_INPUT_LENGTH = 8192 * 4; // max 8192 tokens, 1 token ~ 4 characters.
const MAX_BATCH_SIZE = 2048;

const FILE_PART_SIZE = 1024 * 1024; // 1MB

const lib = require('../lib');

module.exports = {

    receive: async function(context) {

        const config = {
            apiKey: context.auth.apiKey,
            baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/'
        };

        await this.generateEmbeddingsFromFile(context, config, context.messages.in.content, (out) => {
            return context.sendJson(out, 'out');
        });
    },

    generateEmbeddingsFromFile: async function(context, config, input, outputFunction) {

        const {
            fileId
        } = input;
        const client = new OpenAI(config);

        const readStream = await context.getFileReadStream(fileId);
        const fileInfo = await context.getFileInfo(fileId);
        await context.log({ step: 'split-file', message: 'Splitting file into parts.', partSize: FILE_PART_SIZE, fileInfo });

        const partsStream = lib.splitStream(readStream, FILE_PART_SIZE);
        for await (const part of partsStream) {
            let { embeddings, firstVector } = await this.generateEmbeddings(context, client, part.toString());

            if ((!firstVector || firstVector.length === 0) && embeddings.length > 0) {
                firstVector = embeddings[0].vector;
            }
            await outputFunction({ embeddings, firstVector });
        }
    },

    /**
     * Generate embeddings for a text.
     * @param {String} config.apiKey
     * @param {String} config.baseUrl
     * @param {String} input.text
     * @param {String} input.model
     * @param {Number} input.chunkSize
     * @param {Number} input.chunkOverlap
     * @returns Object { embeddings: Array{text:String, vector:Array, index: Integer}, firstVector: Array }
     */
    generateEmbeddings: async function(context, config, text) {

        const client = new OpenAI(config);
        const {
            model = 'text-embedding-004',
            chunkSize = 500,
            chunkOverlap = 50
        } = context.messages.in.content;

        const chunks = await lib.splitText(text, chunkSize, chunkOverlap);
        await context.log({ step: 'split-text', message: 'Text succesfully split into chunks.', chunksLength: chunks.length });

        // Process chunks in batches.
        // the batch size is calculated based on the chunk size and the maximum input length in
        // order not to exceed the maximum input length defined in
        // https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-input
        // We devide the maximum input length by 2 to stay on the safe side
        //  because the token to character ratio might not be accurate.
        const batchSize = Math.min(Math.floor((MAX_INPUT_LENGTH / 2) / chunkSize), MAX_BATCH_SIZE);
        const embeddings = [];
        // For convenience, the GenerateEmbeddings component returns the first vector.
        // This makes it easy to genereate embedding for a prompt and send it e.g. to the pinecone.QueryVectors component
        // without having to apply modifiers to the embedding array returned.
        let firstVector = null;
        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);

            const response = await client.embeddings.create({
                model,
                input: batch,
                encoding_format: 'float'
            });

            // Collect embeddings for the current batch.
            response.data.forEach((item, index) => {
                if (!firstVector) {
                    firstVector = item.embedding;
                }
                const embedding = {
                    text: batch[index],
                    vector: item.embedding,
                    index: i + index
                };
                embeddings.push(embedding);
            });
        }
        return { embeddings, firstVector };
    }
};
