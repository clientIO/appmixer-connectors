'use strict';

const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

// See https://docs.voyageai.com/reference/embeddings-api
const VOYAGE_API_URL = 'https://api.voyageai.com/v1/embeddings';
const MAX_INPUT_LENGTH = 8192 * 4; // max 8192 tokens, 1 token ~ 4 characters.
const MAX_BATCH_SIZE = 2048;

module.exports = {

    receive: async function(context) {

        const {
            text,
            model = 'voyage-3',
            chunkSize = 500,
            chunkOverlap = 50
        } = context.messages.in.content;

        const chunks = await this.splitText(text, chunkSize, chunkOverlap);
        await context.log({ step: 'split-text', message: 'Text succesfully split into chunks.', chunksLength: chunks.length });

        const apiKey = context.auth.apiKey;

        // Process chunks in batches.
        const batchSize = Math.max(1, Math.min(Math.floor((MAX_INPUT_LENGTH / 2) / chunkSize), MAX_BATCH_SIZE));
        const embeddings = [];
        let firstVector = null;

        for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);

            const { data } = await context.httpRequest.post(VOYAGE_API_URL,
                { model, input: batch },
                { headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' } }
            );

            // Voyage returns: { data: [ { embedding: [...], index: 0 }, ... ] }
            data.data.forEach((item, index) => {
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
        return context.sendJson({ embeddings, firstVector }, 'out');
    },

    splitText(text, chunkSize, chunkOverlap) {

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap
        });

        return splitter.splitText(text);
    }
};
