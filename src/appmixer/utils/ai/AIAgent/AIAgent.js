'use strict';

const OpenAI = require('openai');

module.exports = {

    start: async function(context) {

        const assistant = await this.createAssistant(context);
        return context.stateSet('assistant', assistant);
    },

    createAssistant: async function(context) {

        const flowDescriptor = context.flowDescriptor;
        const agentComponentId = context.componentId;
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
                    // assert(flowDescriptor[componentId].type === 'appmixer.utils.ai.CallTool')
                    if (component.type !== 'appmixer.utils.ai.CallTool') {
                        error = `Component ${componentId} is not of type 'ai.CallTool' but ${comopnent.type}.
                            Every tool chain connected to the '${toolsPort}' port of the AI Agent
                            must start with 'ai.CallTool' and end with 'ai.CallToolOutput'.
                            This is where you describe what the tool does and what parameters should the AI model provide to it.`;
                    }
                }
            });
        });

        // Teach the user via logs that they need to use the 'ai.CallTool' component.
        if (error) {
            throw new context.CancelError(error);
        }

        const toolsDefinition = this.getToolsDefinition(tools);

        const instructions = context.properties.instructions || null;
        await context.log({ step: 'create-assistant', tools: toolsDefinition, instructions });

        const apiKey = context.config.apiKey;

        if (!apiKey) {
            throw new context.CancelError('Missing \'apiKey\' system setting of the appmixer.utils.ai module pointing to OpenAI. Please provide it in the Connector Configuration section of the Appmixer Backoffice.');
        }

        const client = new OpenAI({ apiKey });
        const assistant = await client.beta.assistants.create({
            model: context.config.AIAgentModel || 'gpt-4o',
            instructions,
            tools: toolsDefinition
        });

        await context.log({ step: 'created-assistant', assistant });
        return assistant;
    },

    getToolsDefinition: function(tools) {

        // https://platform.openai.com/docs/assistants/tools/function-calling
        const toolsDefinition = [];

        Object.keys(tools).forEach((componentId) => {
            const component = tools[componentId];
            const toolParameters = {
                type: 'object',
                properties: {}
            };
            component.config.properties.parameters.ADD.forEach((parameter) => {
                toolParameters.properties[parameter.name] = {
                    type: parameter.type,
                    description: parameter.description
                };
            });
            const toolDefinition = {
                type: 'function',
                function: {
                    name: componentId,
                    description: component.config.properties.description,
                    parameters: toolParameters
                }
            };
            toolsDefinition.push(toolDefinition);
        });
        return toolsDefinition;
    },

    handleRunStatus: async function(context, client, thread, run) {

        await context.log({ step: 'run-status', run });

        // Check if the run is completed
        if (run.status === 'completed') {
            let messages = await client.beta.threads.messages.list(thread.id);
            await context.log({ step: 'completed-run', run, messages });
            await context.sendJson({
                answer: messages.data[0].content[0].text.value,
                prompt: context.messages.in.content.prompt
            }, 'out');
        } else if (run.status === 'requires_action') {
            await this.handleRequiresAction(context, client, thread, run);
        } else {
            await context.log({ step: 'unexpected-run-state', run });
        }
    },

    handleRequiresAction: async function(context, client, thread, run) {

        await context.log({ step: 'requires-action', run });

        // Check if there are tools that require outputs.
        if (
            run.required_action &&
            run.required_action.submit_tool_outputs &&
            run.required_action.submit_tool_outputs.tool_calls
        ) {
            // Loop through each tool in the required action section.
            const toolCalls = [];
            for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
                const componentId = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                toolCalls.push({ componentId, args, toolCallId: toolCall.id });

                await context.log({ step: 'call-tool', toolCallId: toolCall.id, componentId, args });
                await context.callAppmixer({
                    endPoint: `/flows/${context.flowId}/components/${componentId}`,
                    method: 'POST',
                    body: args,
                    qs: { enqueueOnly: true, correlationId: toolCall.id }
                });
            }

            // Output of each tool is expected to be stored in the service state
            // under the ID of the tool call. This is done in the CallToolOutput component.
            // Collect outputs of all the required tool calls.
            await context.log({ step: 'collect-tools-output', threadId: thread.id, runId: run.id });
            const outputs = [];
            const pollInterval = 1000;
            const pollTimeout = 20000;
            const pollStart = Date.now();
            while ((outputs.length < toolCalls.length) && (Date.now() - pollStart < pollTimeout)) {
                for (const toolCall of toolCalls) {
                    const output = await context.service.stateGet(toolCall.toolCallId);
                    if (output) {
                        outputs.push({ tool_call_id: toolCall.toolCallId, output });
                        await context.service.stateUnset(toolCall.toolCallId);
                    }
                }
                // Sleep.
                await new Promise((resolve) => setTimeout(resolve, pollInterval));
            }
            await context.log({ step: 'collected-tools-output', threadId: thread.id, runId: run.id, outputs });

            // Submit tool outputs to the assistant.
            if (outputs && outputs.length) {
                await context.log({ step: 'tool-outputs', tools: toolCalls, outputs });
                run = await client.beta.threads.runs.submitToolOutputsAndPoll(
                    thread.id,
                    run.id,
                    { tool_outputs: outputs }
                );
            } else {
                await context.log({ step: 'no-tool-outputs', tools: toolCalls });
            }

            // Check status after submitting tool outputs.
            return this.handleRunStatus(context, client, thread, run);
        }
    },

    receive: async function(context) {

        const { prompt } = context.messages.in.content;
        let threadId = context.messages.in.content.threadId || context.messages.in.correlationId;
        const apiKey = context.config.apiKey;
        const client = new OpenAI({ apiKey });
        const assistant = await context.stateGet('assistant');

        // Check if a thread with a given ID exists.
        let thread;
        if (threadId) {
            thread = await context.stateGet(threadId);
        }
        if (!thread) {
            await context.log({ step: 'create-thread', assistantId: assistant.id, internalThreadId: threadId });
            thread = await client.beta.threads.create();
            await context.stateSet(threadId, thread);
        } else {
            await context.log({ step: 'use-thread', assistantId: assistant.id, thread });
        }

        await context.log({ step: 'create-thread-message', assistantId: assistant.id, threadId: thread.id });
        await client.beta.threads.messages.create(thread.id, {
            role: 'user',
            content: prompt
        });

        await context.log({ step: 'create-thread-run', assistantId: assistant.id, threadId: thread.id });
        const run = await client.beta.threads.runs.createAndPoll(thread.id, {
            assistant_id: assistant.id
        });

        await context.log({ step: 'created-thread-run', assistantId: assistant.id, threadId: thread.id, runId: run.id });
        await this.handleRunStatus(context, client, thread, run);
    },

    stop: async function(context) {

        const apiKey = context.config.apiKey;
        const client = new OpenAI({ apiKey });
        const assistant = await context.stateGet('assistant');
        await client.beta.assistants.del(assistant.id);
    }
};
