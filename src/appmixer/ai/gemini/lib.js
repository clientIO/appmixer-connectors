const { Transform } = require('stream');
const { OpenAI }  = require('openai');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

// See https://platform.openai.com/docs/api-reference/embeddings/create#embeddings-create-input.
const MAX_INPUT_LENGTH = 8192 * 4; // max 8192 tokens, 1 token ~ 4 characters.
const MAX_BATCH_SIZE = 2048;

module.exports = {

    extractBaseModelId: function(modelName) {
        if (!modelName || typeof modelName !== 'string') {
            throw new Error('Invalid model name.');
        }

        const match = modelName.split('/')[1];
        return match;
    },

    listModels: async function(config) {

        const client = new OpenAI(config);
        const models = await client.models.list();
        return models;
    },

    /**
     * @param {String} config.apiKey
     * @param {String} config.baseUrl
     * @param {String} input.model
     * @param {String} input.prompt
     * @returns String
     */
    sendPrompt: async function(config, input) {

        const client = new OpenAI(config);
        const completion = await client.chat.completions.create({
            model: input.model,
            messages: [
                { role: 'system', content: input.instructions || 'You are a helpful assistant.' },
                { role: 'user', content: input.prompt }
            ]
        });
        return completion.choices[0].message.content;
    },

    /**
     * @param {String} config.apiKey
     * @param {String} config.baseUrl
     * @param {String} input.model
     * @param {String} input.prompt
     * @param {String} input.jsonSchema
     * @returns Object JSON object that follows the given JSON schema.
     */
    transformTextToJSON: async function(config, input) {

        const client = new OpenAI(config);
        const instructions = 'You are an expert at structured data extraction. You will be given unstructured text and should convert it into the given structure.';
        const completion = await client.chat.completions.create({
            model: input.model,
            messages: [
                { role: 'system', content: input.instructions || instructions },
                { role: 'user', content: input.prompt }
            ],
            response_format: {
                type: 'json_schema',
                json_schema: {
                    name: 'json_extraction',
                    schema: input.jsonSchema
                }
            }
        });
        const json = JSON.parse(completion.choices[0].message.content);
        return json;
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
    generateEmbeddings: async function(context, config, input) {

        const client = new OpenAI(config);
        const {
            text,
            model = 'text-embedding-004',
            chunkSize = 500,
            chunkOverlap = 50
        } = input;

        const chunks = await this.splitText(text, chunkSize, chunkOverlap);
        await context.log({ step: 'split-text', message: 'Text successfully split into chunks.', chunksLength: chunks.length });

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
    },

    splitText(text, chunkSize, chunkOverlap) {

        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize,
            chunkOverlap
        });
        return splitter.splitText(text);
    },

    /**
    * Splits a readable stream into chunks of n bytes.
    * @param {Readable} inputStream - The readable stream to split.
    * @param {number} chunkSize - Size of each chunk in bytes.
    * @returns {Readable} - A readable stream emitting chunks.
    */
    splitStream: function(inputStream, chunkSize) {

        let leftover = Buffer.alloc(0);

        const transformStream = new Transform({
            transform(chunk, encoding, callback) {
                // Combine leftover buffer with the new chunk
                const combined = Buffer.concat([leftover, chunk]);
                const combinedLength = combined.length;

                // Emit chunks of the desired size
                let offset = 0;
                while (offset + chunkSize <= combinedLength) {
                    this.push(combined.slice(offset, offset + chunkSize));
                    offset += chunkSize;
                }

                // Store leftover data
                leftover = combined.slice(offset);

                callback();
            },
            flush(callback) {
                // Push any remaining data as the final chunk
                if (leftover.length > 0) {
                    this.push(leftover);
                }
                callback();
            }
        });

        return inputStream.pipe(transformStream);
    },

    getConnectedToolStartComponents: function(agentComponentId, flowDescriptor) {

        const toolsPort = 'tools';

        // Create a new assistant with tools defined in the branches connected to my 'tools' output port.
        const tools = {};
        let error;

        // Find all components connected to my 'tools' output port.
        Object.keys(flowDescriptor).forEach((componentId) => {
            const component = flowDescriptor[componentId];
            const sources = component.source;
            Object.keys(sources || {}).forEach((inPort) => {
                const source = sources[inPort];
                if (source[agentComponentId] && source[agentComponentId].includes(toolsPort)) {
                    tools[componentId] = component;
                    if (component.type !== 'appmixer.ai.agenttools.ToolStart') {
                        error = `Component ${componentId} is not of type 'ToolStart' but ${component.type}.
                            Every tool chain connected to the '${toolsPort}' port of the AI Agent
                            must start with 'ToolStart' and end with 'ToolOutput'.
                            This is where you describe what the tool does and what parameters should the AI model provide to it.`;
                    }
                }
            });
        });

        if (error) {
            throw new Error(error);
        }
        return tools;
    },

    getFunctionDeclarations: function(tools) {

        const functionDeclarations = [];

        Object.keys(tools).forEach((componentId) => {
            const component = tools[componentId];
            const parameters = component.config.properties.parameters?.ADD || [];
            const functionParameters = {
                type: 'object',
                properties: {}
            };
            parameters.forEach((parameter) => {
                // Skip empty objects
                if (Object.keys(parameter).length === 0) {
                    return;
                }
                functionParameters.properties[parameter.name] = {
                    type: parameter.type,
                    description: parameter.description
                };
            });
            const functionDeclaration = {
                name: 'function_' + componentId,
                description: component.config.properties.description
            };
            if (parameters.length) {
                functionDeclaration.parameters = functionParameters;
            }
            functionDeclarations.push(functionDeclaration);
        });
        return functionDeclarations;
    }

};
