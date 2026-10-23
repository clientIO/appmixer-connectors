'use strict';

const lib = require('../lib');
const componentTool = require('../tool');
const shortuuid = require('short-uuid');
const uuid = require('uuid');

// Polyfill File and Blob for OpenAI SDK in Node.js environment lower than v20.
const { File, Blob } = require('node:buffer');
global.File = global.File || File;
global.Blob = global.Blob || Blob;

const AI_AGENT_MAX_ATTEMPTS = 20; // Max number of agent turns before we stop.
const AI_AGENT_MAX_HISTORY_SIZE = 512000;
const AI_AGENT_MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB
const AI_AGENT_OPENAI_FILE_EXP = 3600 * 24 * 7; // 7 days

module.exports = {

    start: async function(context) {

        await this.collectTools(context);
    },

    collectTools: async function(context) {

        const tools = await this.getAllToolsDefinition(context);
        await context.log({ step: 'tools', tools });
        await context.stateSet('tools', tools);
        return tools;
    },

    getAllToolsDefinition: async function(context) {

        // Everything wired to the 'tools' port is a tool: a 'Tool Start' chain, an action
        // component (the fields mapped to 'Model Defined Parameter' become its parameters) with
        // the components behind it as further steps, or an MCP server. See tool.js.
        const componentToolsDefinition = (await componentTool.collectComponentTools(context))
            .map(componentTool.toPublicToolDef);
        // MCP servers on the legacy 'mcp' port.
        const mcpToolsDefinition = await this.getMCPToolsDefinition(context);
        return componentToolsDefinition.concat(mcpToolsDefinition);
    },

    mcpListTools: async function(context, componentId) {

        const { data } = await context.httpRequest({
            url: `${process.env.APPMIXER_API_URL}/flows/${context.flowId}/components/${componentId}?action=listTools`,
            method: 'POST',
            data: {}
        });

        return data;
    },

    mcpCallTool: async function(context, componentId, toolName, args) {

        const { data } = await context.httpRequest({
            url: `${process.env.APPMIXER_API_URL}/flows/${context.flowId}/components/${componentId}?action=callTool`,
            method: 'POST',
            data: {
                name: toolName,
                arguments: args,
                correlationId: context.messages?.in?.correlationId
            }
        });

        return data;
    },

    isMCPserver: function(context, componentId) {
        // Check if the component is an MCP server.
        const component = context.flowDescriptor[componentId];
        if (!component) {
            return false;
        }
        const category = component.type.split('.').slice(0, 2).join('.');
        const type = component.type.split('.').at(-1);
        if (category === 'appmixer.mcpservers' && type === 'MCPServer') {
            return true;
        }
        return false;
    },

    getMCPToolsDefinition: async function(context) {

        // https://platform.openai.com/docs/assistants/tools/function-calling
        const toolsDefinition = [];

        const flowDescriptor = context.flowDescriptor;
        const agentComponentId = context.componentId;
        const mcpPort = 'mcp';
        const components = {};
        let error;
        // Find all components connected to my 'mcp' output port.
        Object.keys(flowDescriptor).forEach((componentId) => {
            const component = flowDescriptor[componentId];
            const sources = component.source;
            Object.keys(sources || {}).forEach((inPort) => {
                const source = sources[inPort];
                if (source[agentComponentId] && source[agentComponentId].includes(mcpPort)) {
                    components[componentId] = component;
                    if (component.type.split('.').slice(0, 2).join('.') !== 'appmixer.mcpservers') {
                        error = `Component ${componentId} is not an 'MCP Server' but ${component.type}.
                            Every mcp component connected to the '${mcpPort}' port of the AI Agent
                            must be an MCP server.`;
                    }
                }
            });
        });

        // Teach the user via logs that they need to connect only MCP servers to the mcp port.
        if (error) {
            throw new context.CancelError(error);
        }

        for (const componentId in components) {
            // For each 'MCP Server' component, call the component to retrieve available tools.
            const component = components[componentId];
            const tools = await this.mcpListTools(context, componentId);
            await context.log({ step: 'mcp-server-list-tools', componentId, component, tools });

            for (const tool of tools) {
                // Note we convert the UUID component ID to a shorter version
                // to avoid exceeding the 64 characters limit of the function name.
                const name = [shortuuid().fromUUID(componentId), tool.name].join('_');
                const toolDefinition = {
                    type: 'function',
                    function: {
                        name,
                        description: tool.description
                    }
                };
                if (tool.inputSchema) {
                    toolDefinition.function.parameters = tool.inputSchema;
                }
                if (toolDefinition.function.parameters && toolDefinition.function.parameters.type === 'object' && !toolDefinition.function.parameters.properties) {
                    toolDefinition.function.parameters.properties = {};
                }
                toolsDefinition.push(toolDefinition);
            }
        }

        return toolsDefinition;
    },

    publishChatProgressEvent: function(context, step, content) {

        return context.pubSubPublish(`stream:agent:events:${context.messages.in.content.threadId}`, {
            type: 'progress',
            data: {
                id: uuid.v6(), // UUID v6 is time ordered
                step,
                content,
                role: 'agent',
                correlationId: context.messages.in.correlationId,
                componentId: context.componentId,
                flowId: context.flowId
            }
        });
    },

    publishChatDeltaEvent: async function(context, completionId, content) {

        return context.pubSubPublish(`stream:agent:events:${context.messages.in.content.threadId}`, {
            type: 'delta',
            data: {
                id: uuid.v6(), // UUID v6 is time ordered
                content,
                role: 'agent',
                correlationId: context.messages.in.correlationId,
                componentId: context.componentId,
                flowId: context.flowId
            }
        });
    },

    // Every tool call of a turn gets an answer, or OpenAI rejects the next request. Tools on
    // the 'tools' port go through tool.js (different tools at once, calls of one Tool Start
    // one after the other); MCP servers on the legacy 'mcp' port are called here. A failure
    // comes back as the output text for the model to deal with.
    callTools: async function(context, modelToolCalls) {

        if (!modelToolCalls || !modelToolCalls.length) {
            return [];
        }

        if (modelToolCalls.length > 1) {
            await this.publishChatProgressEvent(context, 'tool-calls', `Calling ${modelToolCalls.length} tools.`);
        }

        const outputs = new Map();
        const componentToolDefs = await componentTool.getComponentToolDefs(context);
        const componentToolCalls = [];
        const mcpToolCalls = [];
        for (const toolCall of modelToolCalls) {
            const name = toolCall.function.name;
            await this.publishChatProgressEvent(context, 'tool-call', `Calling tool ${name}.`);
            let args;
            try {
                args = JSON.parse(toolCall.function.arguments || '{}');
            } catch (err) {
                await context.log({
                    step: 'tool-call-json-parse-error',
                    toolCallId: toolCall.id,
                    toolName: name,
                    arguments: toolCall.function.arguments,
                    error: err.message
                });
                outputs.set(toolCall.id,
                    `Error: Failed to parse tool arguments - ${err.message}. Raw arguments: ${toolCall.function.arguments}`);
                continue;
            }
            // A tool of the 'tools' port is resolved by its full name, never by the prefix.
            if (componentToolDefs.some((def) => def.function.name === name)) {
                componentToolCalls.push({ id: toolCall.id, name, args });
            } else {
                mcpToolCalls.push({ id: toolCall.id, name, args });
            }
        }

        const results = await componentTool.executeToolCalls(context, componentToolDefs, componentToolCalls, {
            correlationId: context.messages?.in?.correlationId
        });
        results.forEach(({ id, output }) => outputs.set(id, output));

        for (const { id, name, args } of mcpToolCalls) {
            // '<short component id>_<MCP tool name>', see getMCPToolsDefinition.
            const [prefix, ...rest] = name.split('_');
            const toolName = rest.join('_');
            let componentId = prefix;
            try {
                componentId = uuid.validate(prefix) ? prefix : shortuuid().toUUID(prefix);
            } catch (err) {
                // Not a short UUID: the model made the name up.
            }
            if (!this.isMCPserver(context, componentId)) {
                outputs.set(id, `Error: unknown tool ${name}.`);
                continue;
            }
            let output;
            // Catch errors so that we don't trigger an Appmixer component retry.
            // Simply return the error message instead.
            try {
                output = await this.mcpCallTool(context, componentId, toolName, args);
            } catch (err) {
                await context.log({ step: 'call-tool-error', componentId, toolName, err });
                output = `Error calling tool ${toolName}: ${err.message}`;
            }
            outputs.set(id, typeof output === 'string' ? output : JSON.stringify(output, null, 2));
        }

        return modelToolCalls.map((toolCall) => ({ tool_call_id: toolCall.id, output: outputs.get(toolCall.id) }));
    },

    agent: async function(context, client, instructions, model, prompt, fileId, tools, history) {

        const messages = history || [];
        // The instructions lead every request but stay out of `messages`, which is what gets
        // stored as the thread history. A thread therefore always runs on the current
        // instructions and they survive the history being summarized.
        const instructionsMessage = {
            // Note that we're not using the 'system' role here since it's not
            // supported by all models. For example, o1 models.
            role: 'user',
            content: instructions
        };

        let userContent = prompt;

        if (fileId) {
            // Get the file content from Appmixer file storage and send directly as base64 encoded content.
            try {
                const fileInfo = await context.getFileInfo(fileId);
                await this.publishChatProgressEvent(context, 'file-processing', `Processing file ${fileInfo.filename} (${lib.formatBytes(fileInfo.length)})...`);
                const size = fileInfo.length;
                if (size > (context.config.AI_AGENT_MAX_FILE_SIZE || AI_AGENT_MAX_FILE_SIZE)) {
                    throw new context.CancelError(`File size ${size} exceeds the maximum allowed size of ${context.config.AI_AGENT_MAX_FILE_SIZE || AI_AGENT_MAX_FILE_SIZE} bytes.`);
                }
                const mime = fileInfo.contentType || 'application/octet-stream';
                if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/gif' || mime === 'image/webp') {
                    const fileBuffer = await context.loadFile(fileId);
                    const fileContentBase64 = fileBuffer.toString('base64');
                    // For images, we send the data URI so that the model can easily display it if needed.
                    // Note that the size of the data URI is about 33% larger than the original binary content.
                    userContent = [{
                        type: 'image_url',
                        image_url: {
                            url: `data:${mime};base64,${fileContentBase64}`
                        }
                    }, {
                        type: 'text',
                        text: prompt
                    }];
                } else if (mime === 'application/pdf') {
                    // The chat completion endpoint supports PDF files as 'file' objects uploaded to OpenAI only.
                    const fileStream = await context.getFileReadStream(fileId);
                    const fileResponse = await client.files.create({
                        file: await lib.toFile(fileStream, fileInfo.filename, { type: fileInfo.contentType }),
                        purpose: 'user_data',
                        expires_after: {
                            anchor: 'created_at',
                            seconds: context.config.AI_AGENT_OPENAI_FILE_EXP || AI_AGENT_OPENAI_FILE_EXP
                        }
                    });
                    await context.log({ step: 'openai-file-upload', fileInfo, fileResponse });
                    userContent = [{
                        type: 'file',
                        file: {
                            file_id: fileResponse.id
                        }
                    }, {
                        type: 'text',
                        text: prompt
                    }];
                } else {
                    // Other files are simply sent as a raw text. This is useful if file is e.g. a text file or CSV, JSON, .js, .py, etc.
                    const fileBuffer = await context.loadFile(fileId);
                    userContent = [{
                        type: 'text',
                        text: `File content: ${fileBuffer.toString('utf8')}`
                    }, {
                        type: 'text',
                        text: prompt
                    }];
                    await context.log({ warning: `File type ${mime} is not an image or PDF. It will be parsed as text and sent as a regular prompt.` });
                }
            } catch (err) {
                throw new context.CancelError(`Failed to process file: ${err.message}`);
            }
        }

        messages.push({
            role: 'user',
            content: userContent
        });

        for (let i = 0; i < (context.config.AI_AGENT_MAX_ATTEMPTS || AI_AGENT_MAX_ATTEMPTS); i++) {

            const completion = {
                model,
                messages: [instructionsMessage, ...messages],
                tools
            };
            await context.log({ step: 'agent-completion', completion });
            await this.publishChatProgressEvent(context, 'inference', `Crunching data (${i + 1})...`);
            const choice = context.properties.stream
                ? await this.createStreamCompletion(context, client, completion)
                : await this.createCompletion(context, client, completion);
            const { finish_reason: finishReason, message } = choice;
            messages.push(message);

            if (finishReason === 'tool_calls' && message.tool_calls) {

                const outputs = await this.callTools(context, message.tool_calls);
                (outputs || []).forEach((output) => {
                    // OpenAI requires 'content' to be a string. A tool chain may
                    // produce no output (nothing mapped to ToolOutput's 'output'
                    // field), in which case output.output is null/undefined and
                    // OpenAI rejects the request with
                    // "Invalid value for 'content': expected a string, got null.".
                    let content = output.output;
                    if (content === null || content === undefined) {
                        content = '';
                    } else if (typeof content !== 'string') {
                        content = JSON.stringify(content);
                    }
                    messages.push({
                        role: 'tool',
                        tool_call_id: output.tool_call_id,
                        content
                    });
                });

            } else if (finishReason === 'stop') {
                return { messages, answer: message.content, turns: i + 1 };
            }
        }
        return {
            messages,
            answer: 'The maximum number of iterations has been met without a suitable answer. Please try again with a more specific input.'
        };
    },

    createStreamCompletion: async function(context, client, completion) {

        const stream = await client.chat.completions.create({
            ...completion,
            stream: true,
            stream_options: {
                include_usage: true
            }
        });

        const finalToolCalls = [];
        let finalContent = '';
        let finishReason = null;

        for await (const chunk of stream) {
            // With include_usage: true, the last chunk contains usage field
            // while the choices array is empty.
            const choice = chunk.choices.length ? chunk.choices[0] : {};
            if (choice.finish_reason) {
                finishReason = choice.finish_reason;
            }
            const delta = choice?.delta || {};
            if (delta.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                    const { index } = toolCall;

                    if (!finalToolCalls[index]) {
                        finalToolCalls[index] = {
                            id: toolCall.id,
                            type: toolCall.type,
                            function: {
                                name: toolCall.function.name,
                                arguments: toolCall.function.arguments || ''
                            }
                        };
                    } else {
                        finalToolCalls[index].function.arguments += toolCall.function.arguments || '';
                    }
                }
            } else if (delta.content) {
                finalContent += delta.content;
                await this.publishChatDeltaEvent(context, chunk.id, delta.content);
            }
            if (chunk.usage) {
                // Note that only the last chunk has usage info so this does NOT
                // run with each chunk.
                await this.updateUsage(context, chunk.usage);
            }
        }

        const choice = {
            finish_reason: finishReason,
            message: {
                role: 'assistant',
                content: finalContent
            }
        };

        // Add only when tool calls required. Empty array is not allowed by OpenAI API.
        if (finalToolCalls.length) {
            choice.message.tool_calls = finalToolCalls;
        }

        return choice;
    },

    createCompletion: async function(context, client, completion) {

        const response = await client.chat.completions.create(completion);
        const choice = response.choices[0];
        const usage = response.usage;

        if (usage) {
            // Remember aggregated usage for the current flow.
            await this.updateUsage(context, usage);
        }

        return choice;
    },

    updateUsage: async function(context, usage) {

        /* eslint-disable max-len */
        const totalUsage = await context.stateGet('usage') || {};
        const newUsage = {
            prompt_tokens: (totalUsage.prompt_tokens || 0) + (usage.prompt_tokens || 0),
            completion_tokens: (totalUsage.completion_tokens || 0) + (usage.completion_tokens || 0),
            total_tokens: (totalUsage.total_tokens || 0) + (usage.total_tokens || 0)
        };
        if (usage.prompt_tokens_details) {
            newUsage.prompt_tokens_details = {
                cached_tokens: (totalUsage?.prompt_tokens_details?.cached_tokens || 0) + (usage.prompt_tokens_details.cached_tokens || 0),
                audio_tokens: (totalUsage?.prompt_tokens_details?.audio_tokens || 0) + (usage.prompt_tokens_details.audio_tokens || 0)
            };
        }
        if (usage.completion_tokens_details) {
            newUsage.completion_tokens_details = {
                reasoning_tokens: (totalUsage?.completion_tokens_details?.reasoning_tokens || 0) + (usage.completion_tokens_details.reasoning_tokens || 0),
                audio_tokens: (totalUsage?.completion_tokens_details?.audio_tokens || 0) + (usage.completion_tokens_details.audio_tokens || 0),
                accepted_prediction_tokens: (totalUsage?.completion_tokens_details?.accepted_prediction_tokens || 0) + (usage.completion_tokens_details.accepted_prediction_tokens || 0),
                rejected_prediction_tokens: (totalUsage?.completion_tokens_details?.rejected_prediction_tokens || 0) + (usage.completion_tokens_details.rejected_prediction_tokens || 0)
            };
        }
        /* eslint-enable max-len */
        return context.stateSet('usage', newUsage);
    },

    summarizeHistory: async function(context, client, model, history) {

        const completion = {
            model,
            messages: [{
                role: 'user',
                content: [
                    context.config.AI_AGENT_SUMMARY_PROMPT || 'Summarize the following conversation:',
                    JSON.stringify(history, null, 2)
                ].join('\n')
            }]
        };
        // The summary is capped only when the cap is configured. A fixed default cannot fit
        // every model: it has to stay below the model's own output limit, or the request fails.
        const maxTokens = context.config.AI_AGENT_MAX_HISTORY_SUMMARY_TOKENS;
        if (maxTokens) {
            // OpenAI replaced 'max_tokens' with 'max_completion_tokens' and its newer models
            // reject the old name. Other OpenAI compatible LLMs may only know the old one.
            completion[context.config.llmBaseUrl ? 'max_tokens' : 'max_completion_tokens'] = Number(maxTokens);
        }
        const choice = await this.createCompletion(context, client, completion);

        const { message } = choice;
        return message.content;
    },

    receive: async function(context) {

        await this.publishChatProgressEvent(context, 'start', 'Thinking...');
        const receiveStart = new Date;
        const { prompt, storeId, threadId, fileId } = context.messages.in.content;
        if (!prompt) {
            throw new context.CancelError('Prompt is required');
        }

        // Model and instructions moved from properties to inPorts in 2.0.0 so that they can be
        // bound to flow variables. Fall back to the properties for agents configured before that.
        const model = context.messages.in.content.model || context.properties.model || 'gpt-4o';
        const instructions = context.messages.in.content.instructions
            || context.properties.instructions
            || 'You\'re a helpful assistant.';
        const client = lib.sdk(context);
        let tools = await context.stateGet('tools');
        if (!tools) {
            // If agent is started with OnStart component, the start method might not
            // have been executed yet. So we need to collect tools on-demand here.
            tools = await this.collectTools(context);
        }
        // A Tool Output that came after its call had timed out would stay in the flow state.
        await componentTool.removeLateToolOutputs(context);

        // Check if a thread with a given ID exists.
        let history = [];
        if (threadId) {
            history = await this.loadSummary(context, storeId, threadId);
        }
        const historyLength = history.length;
        const agentTimeStart = new Date;
        const response = await this.agent(
            context,
            client,
            instructions,
            model,
            prompt,
            fileId,
            tools,
            history
        );
        await context.log({ step: 'agent-response', response, time: (new Date) - agentTimeStart });

        const newMessages = response.messages.slice(historyLength);
        if (threadId) {
            await this.saveMessages(context, storeId, threadId, newMessages);
        }
        let newHistory = response.messages;
        const newHistoryText = JSON.stringify(newHistory);
        const maxHistorySize = context.config.AI_AGENT_MAX_HISTORY_SIZE || AI_AGENT_MAX_HISTORY_SIZE;
        if (threadId && (newHistoryText.length > maxHistorySize)) {
            // Limit the history size to around 512kB by default.
            try {
                const summary = await this.summarizeHistory(context, client, model, newHistory);
                newHistory = [{
                    role: 'user',
                    content: summary
                }];
                await context.log({
                    step: 'summarized-history',
                    threadId,
                    oldHistoryTextLength: newHistoryText.length,
                    newHistoryTextLength: summary.length
                });
            } catch (err) {
                // The answer is ready; failing here would throw it away and make the engine
                // run the whole agent again. Keep the full history and try on the next turn.
                await context.log({ step: 'summarize-history-error', threadId, error: err.message });
            }
        }
        if (threadId) {
            await this.saveSummary(context, storeId, threadId, newHistory);
        }

        return context.sendJson({
            answer: response.answer,
            prompt,
            usage: await context.stateGet('usage'),
            time: (new Date) - receiveStart
        }, 'out');
    },

    loadSummary: async function(context, storeId, threadId) {

        const key = `thread_summary_${threadId}`;
        const messagesString = storeId
            ? (await context.store.get(storeId, key)).value
            : await context.stateGet(key);
        const messages = messagesString ? JSON.parse(messagesString) : [];
        return messages;
    },

    saveSummary: function(context, storeId, threadId, summary) {

        const key = `thread_summary_${threadId}`;
        const value = JSON.stringify(summary);
        return storeId
            ? context.store.set(storeId, key, value)
            : context.stateSet(key, value);
    },

    saveMessages: function(context, storeId, threadId, messages) {

        const key = `thread_memory_${threadId}_${(new Date).getTime()}`;
        const value = JSON.stringify(messages);
        return storeId
            ? context.store.set(storeId, key, value)
            : context.stateSet(key, value);
    }
};
