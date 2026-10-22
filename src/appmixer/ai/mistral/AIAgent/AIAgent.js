'use strict';

const lib = require('../lib');
const componentTool = require('../tool');
const uuid = require('uuid');

const AI_AGENT_MAX_ATTEMPTS = 20; // Max number of agent turns before we stop.
const AI_AGENT_MAX_HISTORY_SIZE = 512000;
const AI_AGENT_MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB
const DEFAULT_MODEL = 'mistral-medium-latest';
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];

module.exports = {

    start: async function(context) {

        await this.collectTools(context);
    },

    // Everything wired to the 'tool' port is a tool: an action component (the fields
    // mapped to 'Model Defined Parameter' become its parameters), the components behind
    // it as further steps of the same tool, or an MCP server. See tool.js.
    collectTools: async function(context) {

        const defs = await componentTool.collectComponentTools(context);
        await context.stateSet('toolsCollected', true);
        return defs;
    },

    getTools: async function(context) {

        if (!await context.stateGet('toolsCollected')) {
            // A message from OnStart can arrive before start() has stored the tools.
            return this.collectTools(context);
        }
        return componentTool.getComponentToolDefs(context);
    },

    // The function definition sent to Mistral. Mistral rejects a function without
    // `parameters` (422), unlike OpenAI, so a tool that takes no input still declares
    // an empty object schema.
    toFunctionDef: function(def) {

        const fn = componentTool.toPublicToolDef(def).function;
        return {
            type: 'function',
            function: {
                name: fn.name,
                description: fn.description,
                parameters: this.toParameters(fn.parameters)
            }
        };
    },

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

    // Every tool call of a turn gets an answer, or Mistral rejects the next request.
    // executeComponentTool never throws: a failure comes back as the output text for
    // the model to deal with.
    callTools: async function(context, toolDefs, modelToolCalls) {

        const outputs = [];
        for (const toolCall of modelToolCalls) {
            const toolDef = toolDefs.find((def) => def.function.name === toolCall.function.name);
            await this.publishChatProgressEvent(context, 'tool-call', `Calling tool ${toolCall.function.name}.`);
            if (!toolDef) {
                outputs.push({ tool_call_id: toolCall.id, output: `Error: unknown tool ${toolCall.function.name}.` });
                continue;
            }
            let args;
            try {
                args = JSON.parse(toolCall.function.arguments || '{}');
            } catch (err) {
                await context.log({ step: 'tool-call-json-parse-error', toolCall, error: err.message });
                outputs.push({
                    tool_call_id: toolCall.id,
                    output: `Error: Failed to parse tool arguments - ${err.message}. Raw arguments: ${toolCall.function.arguments}`
                });
                continue;
            }
            const output = await componentTool.executeComponentTool(context, toolDef, args, {
                correlationId: context.messages?.in?.correlationId
            });
            outputs.push({ tool_call_id: toolCall.id, output });
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

    agent: async function(context, instructions, model, prompt, fileId, toolDefs, history) {

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
            if (toolDefs.length) {
                completion.tools = toolDefs.map((def) => this.toFunctionDef(def));
            }
            await context.log({ step: 'agent-completion', completion, turn: i + 1 });
            await this.publishChatProgressEvent(context, 'inference', `Crunching data (${i + 1})...`);
            const choice = context.properties.stream
                ? await this.createStreamCompletion(context, completion)
                : await this.createCompletion(context, completion);
            const { finish_reason: finishReason, message } = choice;
            messages.push(message);

            if (finishReason === 'tool_calls' && message.tool_calls) {

                const outputs = await this.callTools(context, toolDefs, message.tool_calls);
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
        const toolDefs = await this.getTools(context);

        let history = [];
        if (threadId) {
            history = await this.loadSummary(context, storeId, threadId);
        }
        const historyLength = history.length;
        const agentTimeStart = new Date;
        const response = await this.agent(context, instructions, model, prompt, fileId, toolDefs, history);
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
