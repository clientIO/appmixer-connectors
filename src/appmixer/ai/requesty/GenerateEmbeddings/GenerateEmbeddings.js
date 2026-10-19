'use strict';

const lib = require('../lib');

module.exports = {

    async receive(context) {

        const {
            text,
            model,
            chunkSize = 500,
            chunkOverlap = 50
        } = context.messages.in.content;

        if (!model) {
            throw new context.CancelError('Model is required!');
        }
        if (!text) {
            throw new context.CancelError('Text is required!');
        }

        const embeddings = await lib.generateEmbeddings(context, { text, model, chunkSize, chunkOverlap });

        // For convenience the component also returns the first vector on its own. This makes it
        // easy to embed a prompt and send it straight to e.g. pinecone.QueryVectors without
        // having to apply a modifier to the embeddings array.
        return context.sendJson({ embeddings, firstVector: embeddings[0]?.vector ?? null }, 'out');
    }
};
