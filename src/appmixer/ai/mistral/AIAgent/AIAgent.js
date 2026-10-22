'use strict';

const lib = require('../lib');
const shortuuid = require('short-uuid');
const uuid = require('uuid');

const TOOLS_OUTPUT_POLL_TIMEOUT = 2 * 60 * 1000;  // 120 seconds
const TOOLS_OUTPUT_POLL_INTERVAL = 300;  // 300ms
const AI_AGENT_MAX_ATTEMPTS = 20; // Max number of agent turns before we stop.
const AI_AGENT_MAX_HISTORY_SIZE = 512000;
const AI_AGENT_MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB
const DEFAULT_MODEL = 'mistral-medium-latest';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

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

        const flowDescriptor = context.flowDescriptor;
        const agentComponentId = context.componentId;
        const toolsPort = 'tools';

        // Tools are the branches connected to my 'tools' output port.
        const tools = {};
        let error;

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

        // Teach the user via logs that they need to use the 'ToolStart' component.
        if (error) {
            throw new context.CancelError(error);
        }

        const toolsDefinition = this.getToolsDefinition(tools);
        const mcpToolsDefinition = await this.getMCPToolsDefinition(context);
        return toolsDefinition.concat(mcpToolsDefinition);
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

        const component = context.flowDescriptor[componentId];
        if (!component) {
            return false;
        }
        const category = component.type.split('.').slice(0, 2).join('.');
        const type = component.type.split('.').at(-1);
        return category === 'appmixer.mcpservers' && type === 'MCPServer';
    },

    getMCPToolsDefinition: async function(context) {

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

        if (error) {
            throw new context.CancelError(error);
        }

        for (const componentId in components) {
            const component = components[componentId];
            const tools = await this.mcpListTools(context, componentId);
            await context.log({ step: 'mcp-server-list-tools', componentId, component, tools });

            for (const tool of tools) {
                // The short form of the component UUID keeps the function name within
                // the 64 characters Mistral allows.
                const name = [shortuuid().fromUUID(componentId), tool.name].join('_');
                toolsDefinition.push({
                    type: 'function',
                    function: {
                        name,
                        description: tool.description,
                        parameters: this.toParameters(tool.inputSchema)
                    }
                });
            }
        }

        return toolsDefinition;
    },

    // Mistral rejects a function without `parameters` (422), unlike OpenAI, so a tool
    // that takes no input still declares an empty object schema.
    toParameters: function(schema) {

        const parameters = schema && typeof schema === 'object' ? { ...schema } : { type: 'object' };
        if (!parameters.type) {
            parameters.type = 'object';
        }
        if (parameters.type === 'object' && !parameters.properties) {
            parameters.properties = {};
        }
        return parameters;
    },

    getToolsDefinition: function(tools) {

        const toolsDefinition = [];

        Object.keys(tools).forEach((componentId) => {
            const component = tools[componentId];
            const parameters = component.config.properties.parameters?.ADD || [];
            const toolParameters = {
                type: 'object',
                properties: {}
            };
            parameters.forEach((parameter) => {
                // Skip empty objects
                if (Object.keys(parameter).length === 0) {
                    return;
                }
                toolParameters.properties[parameter.name] = {
                    type: parameter.type,
                    description: parameter.description
                };
            });
            let toolName = (component.label || component.type.split('.').pop());
            toolName = toolName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64 - componentId.length - 1);
            toolsDefinition.push({
                type: 'function',
                function: {
                    name: componentId + '_' + toolName,
                    description: component.config.properties.description,
                    parameters: toolParameters
                }
            });
        });
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

    publishChatDeltaEvent: function(context, content) {

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

    callTools: async function(context, modelToolCalls) {

        if (!modelToolCalls || !modelToolCalls.length) {
            return [];
        }

        if (modelToolCalls.length > 1) {
            await this.publishChatProgressEvent(context, 'tool-calls', `Calling ${modelToolCalls.length} tools.`);
        }

        const outputs = [];

        const toolCalls = [];
        for (const toolCall of modelToolCalls) {
            let componentId = toolCall.function.name.split('_')[0];
            const toolName = toolCall.function.name.split('_').slice(1).join('_');
            await this.publishChatProgressEvent(context, 'tool-call', `Calling tool ${toolName}.`);
            if (!uuid.validate(componentId)) {
                // MCP tools carry the short form of the component UUID.
                componentId = shortuuid().toUUID(componentId);
            }
            let args;
            try {
                args = JSON.parse(toolCall.function.arguments || '{}');
            } catch (err) {
                await context.log({
                    step: 'tool-call-json-parse-error',
                    toolCallId: toolCall.id,
                    toolName: toolCall.function.name,
                    arguments: toolCall.function.arguments,
                    error: err.message
                });
                outputs.push({
                    tool_call_id: toolCall.id,
                    output: `Error: Failed to parse tool arguments - ${err.message}. Raw arguments: ${toolCall.function.arguments}`
                });
                continue;
            }
            if (this.isMCPserver(context, componentId)) {
                let output;
                // Catch errors so that we don't trigger an Appmixer component retry.
                // Simply return the error message instead.
                try {
                    output = await this.mcpCallTool(context, componentId, toolName, args);
                } catch (err) {
                    await context.log({ step: 'call-tool-error', componentId, toolName, toolCall, err });
                    output = `Error calling tool ${toolName}: ${err.message}`;
                }
                output = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                outputs.push({ tool_call_id: toolCall.id, output });
            } else {
                toolCalls.push({ componentId, args, id: toolCall.id });
            }
        }

        if (toolCalls.length > 0) {

            // Send to all tools. Each ai.ToolStart ignores tool calls that are not intended for it.
            await context.sendJson({ toolCalls, prompt: context.messages.in.content.prompt }, 'tools');

            // ToolOutput stores each tool's output in the flow state under the tool call ID.
            await context.log({ step: 'collect-tools-output', toolCalls });

            const pollStart = Date.now();
            const pollTimeout = context.config.TOOLS_OUTPUT_POLL_TIMEOUT || TOOLS_OUTPUT_POLL_TIMEOUT;
            const pollInterval = context.config.TOOLS_OUTPUT_POLL_INTERVAL || TOOLS_OUTPUT_POLL_INTERVAL;
            const collectedToolCallIds = new Set();

            while (
                (collectedToolCallIds.size < toolCalls.length) &&
                (Date.now() - pollStart < pollTimeout)
            ) {
                for (const toolCall of toolCalls) {
                    if (!collectedToolCallIds.has(toolCall.id)) {
                        const result = await context.flow.stateGet(toolCall.id);
                        if (result) {
                            outputs.push({ tool_call_id: toolCall.id, output: result.output });
                            collectedToolCallIds.add(toolCall.id);
                            await context.flow.stateUnset(toolCall.id);
                        }
                    }
                }
                await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }
            await context.log({ step: 'collected-tools-output', outputs });
        }

        // Every tool call needs an answer, or the next request is rejected.
        const providedToolCallIds = new Set(outputs.map(output => output.tool_call_id));
        for (const toolCall of modelToolCalls) {
            if (!providedToolCallIds.has(toolCall.id)) {
                const pollTimeout = context.config.TOOLS_OUTPUT_POLL_TIMEOUT || TOOLS_OUTPUT_POLL_TIMEOUT;
                outputs.push({
                    tool_call_id: toolCall.id,
                    output: `Error: Tool call ${toolCall.function.name} timed out or failed to respond within ${pollTimeout}ms`
                });
                await context.log({
                    step: 'tool-call-timeout',
                    toolCallId: toolCall.id,
                    toolName: toolCall.function.name,
                    timeout: pollTimeout
                });
            }
        }

        return outputs;
    },

    /**
     * Turn the optional file into message content. Images go to the model directly;
     * a PDF is read through Mistral OCR first, since chat models take no PDF input;
     * anything else is sent as text (CSV, JSON, source code, ...).
     */
    getUserContent: async function(context, prompt, fileId) {

        if (!fileId) {
            return prompt;
        }

        try {
            const fileInfo = await context.getFileInfo(fileId);
            await this.publishChatProgressEvent(context, 'file-processing', `Processing file ${fileInfo.filename}...`);
            const maxFileSize = context.config.AI_AGENT_MAX_FILE_SIZE || AI_AGENT_MAX_FILE_SIZE;
            if (fileInfo.length > maxFileSize) {
                throw new context.CancelError(`File size ${fileInfo.length} exceeds the maximum allowed size of ${maxFileSize} bytes.`);
            }
            const mime = fileInfo.contentType || 'application/octet-stream';
            const fileBuffer = await context.loadFile(fileId);

            if (IMAGE_TYPES.includes(mime)) {
                return [
                    { type: 'image_url', image_url: `data:${mime};base64,${fileBuffer.toString('base64')}` },
                    { type: 'text', text: prompt }
                ];
            }

            if (mime === 'application/pdf') {
                // https://docs.mistral.ai/api/#tag/ocr
                const { data } = await context.httpRequest({
                    method: 'POST',
                    url: `${lib.getBaseUrl()}/ocr`,
                    headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
                    data: {
                        model: 'mistral-ocr-latest',
                        document: {
                            type: 'document_url',
                            document_url: `data:application/pdf;base64,${fileBuffer.toString('base64')}`
                        }
                    }
                });
                const text = (data?.pages || []).map(page => page.markdown).join('\n\n');
                return [
                    { type: 'text', text: `Content of the file ${fileInfo.filename}:\n${text}` },
                    { type: 'text', text: prompt }
                ];
            }

            await context.log({ warning: `File type ${mime} is not an image or PDF. It will be parsed as text and sent as a regular prompt.` });
            return [
                { type: 'text', text: `File content: ${fileBuffer.toString('utf8')}` },
                { type: 'text', text: prompt }
            ];
        } catch (err) {
            throw new context.CancelError(`Failed to process file: ${err.message}`);
        }
    },

    agent: async function(context, instructions, model, prompt, fileId, tools, history) {

        const messages = history || [];
        // The instructions lead every request but stay out of `messages`, which is what gets
        // stored as the thread history. A thread therefore always runs on the current
        // instructions and they survive the history being summarized.
        const instructionsMessage = { role: 'system', content: instructions };

        messages.push({
            role: 'user',
            content: await this.getUserContent(context, prompt, fileId)
        });

        for (let i = 0; i < (context.config.AI_AGENT_MAX_ATTEMPTS || AI_AGENT_MAX_ATTEMPTS); i++) {

            const completion = {
                model,
                messages: [instructionsMessage, ...messages]
            };
            // An empty tools array is rejected; leave it out when no tool is connected.
            if (tools && tools.length) {
                completion.tools = tools;
            }
            await context.log({ step: 'agent-completion', completion, turn: i + 1 });
            await this.publishChatProgressEvent(context, 'inference', `Crunching data (${i + 1})...`);
            const choice = context.properties.stream
                ? await this.createStreamCompletion(context, completion)
                : await this.createCompletion(context, completion);
            const { finish_reason: finishReason, message } = choice;
            messages.push(message);

            if (finishReason === 'tool_calls' && message.tool_calls) {

                const outputs = await this.callTools(context, message.tool_calls);
                (outputs || []).forEach((output) => {
                    // A tool chain may produce no output (nothing mapped to ToolOutput's
                    // 'output' field); the tool message content still has to be a string.
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

            } else {
                // 'stop', or 'length' when the answer hit the model's token limit - either
                // way this is the final answer.
                return { messages, answer: this.toText(message.content), turns: i + 1 };
            }
        }
        return {
            messages,
            answer: 'The maximum number of iterations has been met without a suitable answer. Please try again with a more specific input.'
        };
    },

    // Reasoning models (magistral) return the content as a list of chunks - `thinking`
    // followed by `text` - rather than a string. The answer is the text part.
    toText: function(content) {

        if (Array.isArray(content)) {
            return content
                .filter(chunk => chunk && chunk.type === 'text')
                .map(chunk => chunk.text)
                .join('');
        }
        return content || '';
    },

    createStreamCompletion: async function(context, completion) {

        // https://docs.mistral.ai/api/#tag/chat - server-sent events, OpenAI-style deltas.
        // The last chunk carries `usage` without asking for it.
        const response = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/chat/completions`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json', accept: 'text/event-stream' }),
            data: { ...completion, stream: true },
            responseType: 'stream'
        });
        const finalToolCalls = [];
        let finalContent = '';
        let finishReason = null;

        const stream = response.data;
        stream.setEncoding('utf8');

        let buffer = '';

        for await (const data of stream) {

            buffer += data;

            // Split into SSE events by blank line; keep the last partial event in the buffer.
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() ?? '';

            for (const evt of events) {
                const payload = evt
                    .split(/\r?\n/)
                    .filter((line) => line.startsWith('data:'))
                    .map((line) => line.slice(5).trim())
                    .join('\n')
                    .trim();

                if (!payload || payload === '[DONE]') {
                    continue;
                }

                let chunk;
                try {
                    chunk = JSON.parse(payload);
                } catch {
                    // Non-JSON keepalive/comment; ignore.
                    continue;
                }
                const choice = chunk.choices?.length ? chunk.choices[0] : {};
                if (choice.finish_reason) {
                    finishReason = choice.finish_reason;
                }
                const delta = choice.delta || {};
                if (delta.tool_calls) {
                    for (const toolCall of delta.tool_calls) {
                        const index = toolCall.index ?? 0;
                        if (!finalToolCalls[index]) {
                            finalToolCalls[index] = {
                                id: toolCall.id,
                                type: toolCall.type || 'function',
                                function: {
                                    name: toolCall.function.name,
                                    arguments: toolCall.function.arguments || ''
                                }
                            };
                        } else {
                            finalToolCalls[index].function.arguments += toolCall.function.arguments || '';
                        }
                    }
                }
                if (typeof delta.content === 'string' && delta.content) {
                    finalContent += delta.content;
                    await this.publishChatDeltaEvent(context, delta.content);
                }
                if (chunk.usage) {
                    await this.updateUsage(context, chunk.usage);
                }
            }
        }

        const choice = {
            finish_reason: finishReason,
            message: {
                role: 'assistant',
                content: finalContent
            }
        };

        // Add only when tool calls are required; an empty array is not allowed.
        if (finalToolCalls.length) {
            choice.message.tool_calls = finalToolCalls;
        }

        return choice;
    },

    createCompletion: async function(context, completion) {

        // https://docs.mistral.ai/api/#tag/chat
        const { data } = await context.httpRequest({
            method: 'POST',
            url: `${lib.getBaseUrl()}/chat/completions`,
            headers: lib.requestHeaders(context, { 'content-type': 'application/json' }),
            data: completion
        });

        if (data.usage) {
            await this.updateUsage(context, data.usage);
        }

        return data.choices[0];
    },

    updateUsage: async function(context, usage) {

        // Usage is aggregated for the whole receive() - every agent turn and the history summary.
        const totalUsage = await context.stateGet('usage') || {};
        return context.stateSet('usage', {
            prompt_tokens: (totalUsage.prompt_tokens || 0) + (usage.prompt_tokens || 0),
            completion_tokens: (totalUsage.completion_tokens || 0) + (usage.completion_tokens || 0),
            total_tokens: (totalUsage.total_tokens || 0) + (usage.total_tokens || 0)
        });
    },

    summarizeHistory: async function(context, model, history) {

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
            completion.max_tokens = Number(maxTokens);
        }
        const choice = await this.createCompletion(context, completion);
        return this.toText(choice.message.content);
    },

    receive: async function(context) {

        const { prompt, storeId, threadId, fileId } = context.messages.in.content;
        if (!prompt) {
            throw new context.CancelError('Prompt is required!');
        }
        await this.publishChatProgressEvent(context, 'start', 'Thinking...');
        const receiveStart = new Date;

        const model = context.messages.in.content.model || DEFAULT_MODEL;
        const instructions = context.messages.in.content.instructions || 'You\'re a helpful assistant.';

        // Usage is reported per message, not accumulated across messages.
        await context.stateUnset('usage');
        let tools = await context.stateGet('tools');
        if (!tools) {
            // If agent is started with OnStart component, the start method might not
            // have been executed yet. So we need to collect tools on-demand here.
            tools = await this.collectTools(context);
        }

        let history = [];
        if (threadId) {
            history = await this.loadSummary(context, storeId, threadId);
        }
        const historyLength = history.length;
        const agentTimeStart = new Date;
        const response = await this.agent(context, instructions, model, prompt, fileId, tools, history);
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
                const summary = await this.summarizeHistory(context, model, newHistory);
                newHistory = [{ role: 'user', content: summary }];
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
            ? (await context.store.get(storeId, key))?.value
            : await context.stateGet(key);
        return messagesString ? JSON.parse(messagesString) : [];
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
