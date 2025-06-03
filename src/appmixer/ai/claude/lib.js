const { Transform } = require('stream');
const { RecursiveCharacterTextSplitter } = require('langchain/text_splitter');

module.exports = {

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
                // Each parameter name must match /^[a-zA-Z0-9_-]{1,64}$/, see https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use#example-of-a-good-tool-description
                if (!/^[a-zA-Z0-9_-]{1,64}$/.test(parameter.name)) {
                    throw new Error(`Parameter name '${parameter.name}' in component ${componentId} does not match the required pattern.`);
                }
                // Skip empty objects
                if (Object.keys(parameter).length === 0) {
                    return;
                }
                functionParameters.properties[parameter.name] = {
                    type: parameter.type,
                    description: parameter.description
                };
            });
            const description = component.config.properties?.description;
            if (!description) {
                throw new Error(`Component ${componentId} does not have a description.`);
            }
            const functionDeclaration = {
                name: 'function_' + componentId,
                description: component.config.properties.description,
                input_schema: functionParameters
            };
            functionDeclarations.push(functionDeclaration);
        });
        return functionDeclarations;
    }

};
