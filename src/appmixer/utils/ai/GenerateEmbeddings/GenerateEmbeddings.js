'use strict';

const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');
const OpenAI = require('openai');

const BATCH_SIZE = 10;

module.exports = {

    receive: async function(context) {

        const correlationId = context.messages.in.correlationId;
        const { text, chunkSize, chunkOverlap } = context.messages.in.content;

        const chunks = await this.splitText(text, chunkSize, chunkOverlap);
        await context.log({ step: 'split-text', message: 'Text succesfully split into chunks.', chunksLength: chunks.length });

        const apiKey = context.config.apiKey;
        if (!apiKey) {
            throw new context.CancelError('Missing \'apiKey\' system setting of the appmixer.utils.ai module pointing to OpenAI. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }
        const client = new OpenAI({ apiKey });

        // Process chunks in batches
        const embeddings = [];
        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
            const batch = chunks.slice(i, i + BATCH_SIZE);

            const response = await client.embeddings.create({
                model: context.config.GenerateEmbeddingsModel || 'text-embedding-ada-002',
                input: batch,
                encoding_format: 'float'
            });

            // Collect embeddings for the current batch.
            response.data.forEach((item, index) => {
                embeddings.push({
                    id: `${correlationId}:${i}:${index}`,
                    values: item.embedding,
                    metadata: { text: batch[index] }
                });
            });
        }
        return context.sendJson({ embeddings }, 'out');
    },

    splitText(text, chunkSize, chunkOverlap) {

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: typeof chunkSize !== 'undefined' ? chunkSize : 500,
            chunkOverlap: typeof chunkOverlap !== 'undefined' ? chunkOverlap : 50
        });

        return splitter.splitText(text);
    }
};
