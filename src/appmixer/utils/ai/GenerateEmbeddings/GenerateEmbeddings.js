'use strict';

const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const OpenAI = require('openai');

// See https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-input.
const MAX_INPUT_LENGTH = 8192 * 4; // max 8192 tokens, 1 token ~ 4 characters.
const MAX_BATCH_SIZE = 2048;

module.exports = {

    receive: async function(context) {

        const messageId = context.messages.in.messageId;
        const {
            text,
            model = 'text-embedding-ada-002',
            chunkSize = 500,
            chunkOverlap = 50,
            embeddingTemplate = '{ "id": "{messageId}:{chunkIndex}", "values": {embedding}, "metadata": { "text": "{chunkText}" } }'
        } = context.messages.in.content;

        const chunks = await this.splitText(text, chunkSize, chunkOverlap);
        await context.log({ step: 'split-text', message: 'Text succesfully split into chunks.', chunksLength: chunks.length });

        const apiKey = context.config.apiKey;
        if (!apiKey) {
            throw new context.CancelError('Missing \'apiKey\' system setting of the appmixer.utils.ai module pointing to OpenAI. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }
        const client = new OpenAI({ apiKey });

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
                try {
                    const embedding = this.createEmbedding(embeddingTemplate, {
                        embedding: JSON.stringify(item.embedding),
                        chunkIndex: i + index,
                        chunkText: JSON.stringify(batch[index]).slice(1, -1),
                        messageId,
                        now: Date.now()
                    });
                    embeddings.push(embedding);
                } catch (err) {
                    // It does not make sense to retry the component call.
                    // Things "won't" improve.
                    throw new context.CancelError(err);
                }
            });
        }
        return context.sendJson({ embeddings, firstVector }, 'out');
    },

    createEmbedding(embeddingTemplate, args) {

        const unknownPlaceholders = [];
        const embeddingString = embeddingTemplate.replace(/{([^{}]+)}/g, (match, key) => {
            if (key in args) {
                return args[key];
            } else {
                unknownPlaceholders.push(key);
                return match;
            }
        });

        if (unknownPlaceholders.length) {
            throw new Error(`Unknown placeholders in the embedding template: ${unknownPlaceholders.join(', ')}. Template: ${embeddingTemplate}.`);
        }

        let embedding;
        try {
            embedding = JSON.parse(embeddingString);
        } catch (err) {
            throw new Error(`Failed to parse the embedding string. Error: ${err.message}. ${embeddingString}.`);
        }

        return embedding;
    },

    splitText(text, chunkSize, chunkOverlap) {

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap
        });

        return splitter.splitText(text);
    }
};

