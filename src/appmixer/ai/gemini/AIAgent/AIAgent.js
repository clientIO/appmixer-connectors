'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');

const lib = require('../lib');

const COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT = 60 * 1000;  // 60 seconds
const COLLECT_TOOL_OUTPUTS_POLL_INTERVAL = 1 * 1000;  // 1 second

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

        const { prompt, model, instructions } = context.messages.in.content;
        const threadId = context.messages.in.content.threadId;
        const correlationId = context.messages.in.correlationId;

        const genAI = new GoogleGenerativeAI(context.auth.apiKey);
        const params = {
            model,
            systemInstruction: instructions || 'You are a helpful assistant. If you detect you cannot use any tool, always reply directly as if no tools were given to you.'
        };
        const functionDeclarations = await context.stateGet('functionDeclarations');
        if (functionDeclarations && functionDeclarations.length) {
            params.tools = { functionDeclarations };
            params.functionCallingConfig = {
                mode: 'AUTO' // Options: 'AUTO', 'ANY', 'NONE'
            };
        }

        const client = genAI.getGenerativeModel(params);

        const messages = threadId ? await context.stateGet(`history:${threadId}`) || [] : [];
        messages.push({ role: 'user', parts: [{ text: prompt }] });
        if (threadId) {
            await context.stateSet(`history:${threadId}`, messages);
        }

        while (true) {

            await context.log({ step: 'turn', messages });

            const result = await client.generateContent({ contents: messages });

            let functionCalls = result.response.functionCalls();
            if (functionCalls && functionCalls.length) {

                messages.push({ role: 'model', parts: functionCalls.map(call => ({ functionCall: call })) });

                await context.log({ step: 'function-calls', message: `AI requested ${functionCalls.length} function(s) in parallel`, functionCalls });

                const calls = [];
                for (const call of functionCalls) {
                    const componentId = call.name.split('_')[1];
                    const callId = `${call.name}:${correlationId}`;
                    calls.push({ componentId, args: call.args, id: callId, name: call.name });
                }

                // Send to all tools. Each ai.ToolStart ignores tool calls that are not intended for it.
                await context.sendJson({ toolCalls: calls, prompt }, 'tools');

                // Output of each tool is expected to be stored in the service state
                // under the ID of the tool call. This is done in the ToolStartOutput component.
                // Collect outputs of all the required tool calls.
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
                    // Sleep.
                    await new Promise((resolve) => setTimeout(resolve, COLLECT_TOOL_OUTPUTS_POLL_INTERVAL));
                }
                await context.log({ step: 'collected-tools-output', threadId, outputs });

                // Submit tool outputs to the assistant.
                if (outputs && outputs.length) {
                    await context.log({ step: 'tool-outputs', tools: calls, outputs });
                    // Send all function results back to the AI.
                    messages.push(
                        ...outputs.map(({ name, output }) => ({
                            role: 'user',
                            parts: [{ functionResponse: {
                                name,
                                response: {
                                    name,
                                    content: output
                                }
                            } }]
                        }))
                    );

                } else {
                    await context.log({ step: 'no-tool-outputs', tools: toolCalls });
                }
            } else {
                // Final answer, no more function calls.

                const answer = result.response.text();
                messages.push({ role: 'model', parts: [{ text: answer }] });

                if (threadId) {
                    await context.stateSet(`history:${threadId}`, messages);
                }
                return context.sendJson({ answer, prompt }, 'out');
            }
        }
    }
};
