'use strict';

const OpenAI = require('openai');

const COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT = 60 * 1000;  // 60 seconds
const COLLECT_TOOL_OUTPUTS_POLL_INTERVAL = 1 * 1000;  // 1 second
const MAX_RUN_DURATION = 5 * 60 * 1000;  // 5 minutes

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

        const instructions = context.properties.instructions || null;
        await context.log({ step: 'create-assistant', tools: toolsDefinition, instructions });

        const apiKey = context.auth.apiKey;
        const client = new OpenAI({ apiKey });
        const assistant = await client.beta.assistants.create({
            model: context.properties.model || 'gpt-4o',
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
            const parameters = component.config.properties.parameters?.ADD || [];
            const toolParameters = {
                type: 'object',
                properties: {}
            };
            parameters.forEach((parameter) => {
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
                }
            };
            if (parameters.length) {
                toolDefinition.function.parameters = toolParameters;
            }
            toolsDefinition.push(toolDefinition);
        });
        return toolsDefinition;
    },

    handleRunStatus: async function(context, client, thread, run) {

        if (Date.now() - (run.created_at * 1000) > MAX_RUN_DURATION) {
            await context.log({ step: 'run-timeout', run });
            await client.beta.threads.runs.cancel(thread.id, run.id);
            throw new context.CancelError('The run took too long to complete.');
        }

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
            // incomplete, cancelled, failed, expired
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
            const toolCalls = [];
            for (const toolCall of run.required_action.submit_tool_outputs.tool_calls) {
                const componentId = toolCall.function.name;
                const args = JSON.parse(toolCall.function.arguments);
                toolCalls.push({ componentId, args, id: toolCall.id });
            }

            // Send to all tools. Each ai.ToolStart ignores tool calls that are not intended for it.
            await context.sendJson({ toolCalls, prompt: context.messages.in.content.prompt }, 'tools');

            // Output of each tool is expected to be stored in the service state
            // under the ID of the tool call. This is done in the ToolStartOutput component.
            // Collect outputs of all the required tool calls.
            await context.log({ step: 'collect-tools-output', threadId: thread.id, runId: run.id });
            const outputs = [];
            const pollStart = Date.now();
            const runExpiresAt = run.expires_at;
            while (
                (outputs.length < toolCalls.length) &&
                (runExpiresAt ?
                    Date.now() / 1000 < runExpiresAt :
                    Date.now() - pollStart < COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT)
            ) {
                for (const toolCall of toolCalls) {
                    const result = await context.flow.stateGet(toolCall.id);
                    if (result) {
                        outputs.push({ tool_call_id: toolCall.id, output: result.output });
                        await context.flow.stateUnset(toolCall.id);
                    }
                }
                // Sleep.
                await new Promise((resolve) => setTimeout(resolve, COLLECT_TOOL_OUTPUTS_POLL_INTERVAL));
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
                // Check status after submitting tool outputs.
                await this.handleRunStatus(context, client, thread, run);

            } else {
                await context.log({ step: 'no-tool-outputs', tools: toolCalls });
            }
        }
    },

    receive: async function(context) {

        const { prompt } = context.messages.in.content;
        let threadId = context.messages.in.content.threadId || context.messages.in.correlationId;
        const apiKey = context.auth.apiKey;
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
        let run = await client.beta.threads.runs.create(thread.id, {
            assistant_id: assistant.id
        });
        await context.log({ step: 'created-thread-run', assistantId: assistant.id, threadId: thread.id, run });

        // Poll the run status until it reaches a terminal state.
        run = await client.beta.threads.runs.poll(thread.id, run.id);
        await this.handleRunStatus(context, client, thread, run);
    },

    stop: async function(context) {

        const apiKey = context.auth.apiKey;
        const client = new OpenAI({ apiKey });
        const assistant = await context.stateGet('assistant');
        await client.beta.assistants.del(assistant.id);
    }
};
