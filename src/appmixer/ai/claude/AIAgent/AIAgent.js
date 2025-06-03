/* eslint-disable camelcase */

const lib = require('../lib.js');

const COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT = 60 * 1000;  // 60 seconds
const COLLECT_TOOL_OUTPUTS_POLL_INTERVAL = 1 * 1000;  // 1 second
const DEFAULT_MAX_TOKENS = 1024;

module.exports = {

    start: async function(context) {
        try {
            const tools = lib.getConnectedToolStartComponents(context.componentId, context.flowDescriptor);
            const functionDeclarations = lib.getFunctionDeclarations(tools);

            return context.stateSet('functionDeclarations', functionDeclarations);
        } catch (error) {
            throw new context.CancelError(error);
        }
    },

    receive: async function(context) {
        const { prompt, model, instructions, max_tokens } = context.messages.in.content;
        const threadId = context.messages.in.content.threadId;
        const correlationId = context.messages.in.correlationId;

        const functionDeclarations = await context.stateGet('functionDeclarations');
        let system = instructions || 'You are a helpful assistant. If you detect you cannot use any tool, always reply directly as if no tools were given to you.';
        let messages = threadId ? await context.stateGet(`history:${threadId}`) || [] : [];
        messages.push({ role: 'user', content: prompt });
        if (threadId) {
            await context.stateSet(`history:${threadId}`, messages);
        }

        while (true) {
            await context.log({ step: 'turn', messages });

            // Prepare tool use for Anthropic if functionDeclarations exist
            let toolsConfig = undefined;
            if (functionDeclarations && functionDeclarations.length) {
                toolsConfig = functionDeclarations;
            }

            // Prepare the request to Anthropic
            const requestData = {
                system,
                messages,
                max_tokens: max_tokens || DEFAULT_MAX_TOKENS,
                model
            };
            if (toolsConfig) {
                requestData.tools = toolsConfig;
            }

            const { data } = await context.httpRequest({
                method: 'POST',
                url: 'https://api.anthropic.com/v1/messages',
                headers: {
                    'x-api-key': context.auth.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                data: requestData
            });

            // Check for tool calls in the response
            const toolUse = data?.content?.find(part => part.type === 'tool_use');
            if (toolUse && toolUse.id && toolUse.name) {
                // Anthropic tool call format: { id, name, input }
                const callId = `${toolUse.name}:${correlationId}`;
                const calls = [{
                    componentId: toolUse.name.split('_')[1],
                    args: toolUse.input,
                    id: callId,
                    name: toolUse.name
                }];
                messages.push({ role: 'assistant', content: [{ type: 'tool_use', id: toolUse.id, name: toolUse.name, input: toolUse.input }] });
                await context.log({ step: 'function-calls', message: 'AI requested 1 function', functionCalls: [toolUse] });
                await context.sendJson({ toolCalls: calls, prompt }, 'tools');

                // Collect tool outputs
                await context.log({ step: 'collect-tools-output', threadId });
                const outputs = [];
                const pollStart = Date.now();
                while (
                    (outputs.length < calls.length) &&
                    (Date.now() - pollStart < COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT)
                ) {
                    for (const call of calls) {
                        const result = await context.flow.stateGet(call.id);
                        if (result) {
                            outputs.push({ name: call.name, output: result.output });
                            await context.flow.stateUnset(call.id);
                        }
                    }
                    await new Promise((resolve) => setTimeout(resolve, COLLECT_TOOL_OUTPUTS_POLL_INTERVAL));
                }
                await context.log({ step: 'collected-tools-output', threadId, outputs });

                // Submit tool outputs to the assistant as a new message
                if (outputs && outputs.length) {
                    await context.log({ step: 'tool-outputs', tools: calls, outputs });
                    messages.push(
                        ...outputs.map(({ name, output }) => ({
                            role: 'user',
                            content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: output }]
                        }))
                    );
                } else {
                    await context.log({ step: 'no-tool-outputs', tools: calls });
                }
            } else {
                // Final answer, no more function calls.
                let answer = '';
                if (data?.content && Array.isArray(data.content)) {
                    const textPart = data.content.find(part => part.type === 'text');
                    answer = textPart?.text || '';
                }
                messages.push({ role: 'assistant', content: [{ type: 'text', text: answer }] });
                if (threadId) {
                    await context.stateSet(`history:${threadId}`, messages);
                }
                return context.sendJson({ answer, prompt }, 'out');
            }
        }
    }
};
