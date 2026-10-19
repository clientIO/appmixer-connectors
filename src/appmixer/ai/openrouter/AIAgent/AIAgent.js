'use strict';

const lib = require('../lib');

const AI_AGENT_MAX_ATTEMPTS = 20; // Max number of agent turns before we stop.
const AI_AGENT_MAX_HISTORY_SIZE = 512000;
const AI_AGENT_MAX_HISTORY_SUMMARY_TOKENS = 32000;
const AI_AGENT_MAX_FILE_SIZE = 1024 * 1024 * 5; // 5MB

module.exports = {

    start: async function(context) {

        await lib.collectTools(context);
    },

    agent: async function(context, instructions, model, prompt, fileId, tools, history) {

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
                await lib.publishChatProgressEvent(context, 'file-processing', `Processing file ${fileInfo.filename} (${lib.formatBytes(fileInfo.length)})...`);
                const size = fileInfo.length;
                if (size > (context.config.AI_AGENT_MAX_FILE_SIZE || AI_AGENT_MAX_FILE_SIZE)) {
                    throw new context.CancelError(`File size ${size} exceeds the maximum allowed size of ${context.config.AI_AGENT_MAX_FILE_SIZE || AI_AGENT_MAX_FILE_SIZE} bytes.`);
                }
                const mime = fileInfo.contentType || 'application/octet-stream';
                if (mime === 'image/png' || mime === 'image/jpeg' || mime === 'image/jpg' || mime === 'image/gif' || mime === 'image/webp') {
                    const fileBuffer = await context.loadFile(fileId);
                    const fileContentBase64 = fileBuffer.toString('base64');
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
                    const fileBuffer = await context.loadFile(fileId);
                    const fileContentBase64 = fileBuffer.toString('base64');
                    userContent = [{
                        type: 'file',
                        file: {
                            filename: fileInfo.filename,
                            file_data: `data:${mime};base64,${fileContentBase64}`
                        }
                    }, {
                        type: 'text',
                        text: prompt
                    }];
                } else if (mime === 'audio/wav' || mime === 'audio/mp3' || mime === 'audio/mpeg' || mime === 'audio/x-wav') {
                    const fileBuffer = await context.loadFile(fileId);
                    const fileContentBase64 = fileBuffer.toString('base64');
                    userContent = [{
                        type: 'input_audio',
                        input_audio: {
                            data: fileContentBase64,
                            format: mime.split('/').pop()
                        }
                    }, {
                        type: 'text',
                        text: prompt
                    }];
                } else {
                    // Other files are simply sent as a raw text. This is useful if file is e.g. a text file or CSV, JSON, .js, .py, etc.
                    const fileBuffer = await context.loadFile(fileId);
                    let textContent;
                    try {
                        textContent = fileBuffer.toString('utf8');
                    } catch (err) {
                        throw new context.CancelError(`File type ${mime} cannot be decoded as text: ${err.message}`);
                    }
                    userContent = [{
                        type: 'text',
                        text: `File content: ${textContent}`
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
            await context.log({ step: 'agent-completion', completion, turn: i + 1 });
            await lib.publishChatProgressEvent(context, 'inference', `Crunching data (${i + 1})...`);
            const choice = context.properties.stream
                ? await this.createStreamCompletion(context, completion)
                : await this.createCompletion(context, completion);
            const { finish_reason: finishReason, message } = choice;
            messages.push(message);

            if (finishReason === 'tool_calls' && message.tool_calls) {

                const outputs = await lib.callTools(context, message.tool_calls);
                (outputs || []).forEach((output) => {
                    messages.push({
                        role: 'tool',
                        tool_call_id: output.tool_call_id,
                        content: output.output
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

    createStreamCompletion: async function(context, completion) {

        const response = await lib.request(
            context,
            'post',
            '/chat/completions',
            { ...completion, stream: true },
            { responseType: 'stream' }
        );
        const finalToolCalls = [];
        let finalContent = '';
        let finishReason = null;

        const stream = response.data;
        stream.setEncoding('utf8');

        let buffer = '';

        for await (const chunk of stream) {

            buffer += chunk;

            // Split into SSE events by blank line; keep last partial in buffer
            const events = buffer.split(/\r?\n\r?\n/);
            buffer = events.pop() ?? '';

            for (const evt of events) {
                // Collect all data: lines in this event (SSE allows multi-line data)
                const dataLines = evt
                    .split(/\r?\n/)
                    .filter((l) => l.startsWith('data:'))
                    .map((l) => l.slice(5).trim());

                if (dataLines.length === 0) continue;
                const payload = dataLines.join('\n').trim();

                if (payload === '[DONE]') {
                    break; // stop the generator
                }

                // OpenRouter streams OpenAI-style deltas
                try {
                    const chunk = JSON.parse(payload);
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
                        await lib.publishChatDeltaEvent(context, chunk.id, delta.content);
                    }
                    if (chunk.usage) {
                        // Note that only the last chunk has usage info so this does NOT
                        // run with each chunk.
                        await lib.updateUsage(context, chunk.usage);
                    }

                } catch {
                    // Non-JSON keepalive/comment; ignore
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

        // Add only when tool calls required. Empty array is not allowed by OpenAI API.
        if (finalToolCalls.length) {
            choice.message.tool_calls = finalToolCalls;
        }

        return choice;
    },

    createCompletion: async function(context, completion) {

        const response = await lib.request(context, 'post', '/chat/completions', completion);
        const choice = response.data.choices[0];
        const usage = response.data.usage;

        if (usage) {
            // Remember aggregated usage for the current flow.
            await lib.updateUsage(context, usage);
        }

        return choice;
    },

    summarizeHistory: async function(context, model, history) {

        const choice = await this.createCompletion(context, {
            model,
            messages: [{
                role: 'user',
                content: [
                    context.config.AI_AGENT_SUMMARY_PROMPT || 'Summarize the following conversation:',
                    JSON.stringify(history, null, 2)
                ].join('\n')
            }],
            max_tokens: context.config.AI_AGENT_MAX_HISTORY_SUMMARY_TOKENS || AI_AGENT_MAX_HISTORY_SUMMARY_TOKENS
        });

        const { message } = choice;
        return message.content;
    },

    receive: async function(context) {

        await lib.publishChatProgressEvent(context, 'start', 'Thinking...');
        const receiveStart = new Date;
        const { prompt, storeId, threadId, fileId } = context.messages.in.content;
        const model = context.properties.model;
        let tools = await context.stateGet('tools');
        if (!tools) {
            // If agent is started with OnStart component, the start method might not
            // have been executed yet. So we need to collect tools on-demand here.
            tools = await lib.collectTools(context);
        }

        // Check if a thread with a given ID exists.
        let history = [];
        if (threadId) {
            history = await lib.loadSummary(context, storeId, threadId);
        }
        const historyLength = history.length;
        const agentTimeStart = new Date;
        const response = await this.agent(
            context,
            context.properties.instructions || 'You\'re a helpful assistant.',
            model,
            prompt,
            fileId,
            tools,
            history
        );
        await context.log({ step: 'agent-response', response, time: (new Date) - agentTimeStart });

        const newMessages = response.messages.slice(historyLength);
        if (threadId) {
            await lib.saveMessages(context, storeId, threadId, newMessages);
        }
        let newHistory = response.messages;
        const newHistoryText = JSON.stringify(newHistory);
        const maxHistorySize = context.config.AI_AGENT_MAX_HISTORY_SIZE || AI_AGENT_MAX_HISTORY_SIZE;
        if (threadId && (newHistoryText.length > maxHistorySize)) {
            // Limit the history size to around 512kB by default.
            const summary = await this.summarizeHistory(context, model, newHistory);
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
        }
        if (threadId) {
            await lib.saveSummary(context, storeId, threadId, newHistory);
        }

        return context.sendJson({
            answer: response.answer,
            prompt,
            usage: await context.stateGet('usage'),
            time: (new Date) - receiveStart
        }, 'out');
    }
};
