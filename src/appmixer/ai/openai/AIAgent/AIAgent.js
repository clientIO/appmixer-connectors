'use strict';

const OpenAI = require('openai');
const shortuuid = require('short-uuid');
const uuid = require('uuid');

const COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT = 60 * 1000;  // 60 seconds
const COLLECT_TOOL_OUTPUTS_POLL_INTERVAL = 1 * 1000;  // 1 second
const MAX_ATTEMPTS = 20;

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
        const mcpToolsDefinition = await this.getMCPToolsDefinition(context);
        return toolsDefinition.concat(mcpToolsDefinition);
    },

    mcpListTools: function(context, componentId) {

        return context.callAppmixer({
            endPoint: `/flows/${context.flowId}/components/${componentId}?action=listTools`,
            method: 'POST',
            body: {}
        });
    },

    mcpCallTool: function(context, componentId, toolName, args) {

        return context.callAppmixer({
            endPoint: `/flows/${context.flowId}/components/${componentId}?action=callTool`,
            method: 'POST',
            body: {
                name: toolName,
                arguments: args
            }
        });
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
                // Skip empty objects
                if (Object.keys(parameter).length === 0) {
                    return;
                }
                toolParameters.properties[parameter.name] = {
                    type: parameter.type,
                    description: parameter.description
                };
            });
            const toolDefinition = {
                type: 'function',
                function: {
                    name: componentId,
                    description: component.config.properties.description
                }
            };
            if (parameters.length) {
                toolDefinition.function.parameters = toolParameters;
            }
            toolsDefinition.push(toolDefinition);
        });
        return toolsDefinition;
    },

    callTools: async function(context, modelToolCalls) {

        if (!modelToolCalls || !modelToolCalls.length) {
            return [];
        }

        if (modelToolCalls.length > 1) {
            await context.sendJson({ status: `Calling ${modelToolCalls.length} tools.` }, 'progress');
        }

        const outputs = [];

        const toolCalls = [];
        for (const toolCall of modelToolCalls) {
            let componentId = toolCall.function.name.split('_')[0];
            const toolName = toolCall.function.name.split('_').slice(1).join('_');
            await context.sendJson({ status: `Calling tool ${toolName}.` }, 'progress');
            if (!uuid.validate(componentId)) {
                // Short version of the UUID.
                // Get back the original compoennt UUID back from the short version.
                componentId = shortuuid().toUUID(componentId);
            }
            const args = JSON.parse(toolCall.function.arguments);
            if (this.isMCPserver(context, componentId)) {
                // MCP Server. Get output directly.
                let output;
                // Catch errors so that we don't trigger an Appmixer component retry.
                // Simply return the error message instead.
                try {
                    output = await this.mcpCallTool(
                        context,
                        componentId,
                        toolName,
                        args
                    );
                } catch (err) {
                    await context.log({ step: 'call-tool-error', componentId, toolName, toolCall, err });
                    output = `Error calling tool ${toolName}: ${err.message}`;
                }
                output = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                outputs.push({ tool_call_id: toolCall.id, output });
            } else {
                // Regular Appmixer tool chain.
                toolCalls.push({ componentId, args, id: toolCall.id });
            }
        }

        if (toolCalls.length > 0) {

            // Send to all tools. Each ai.ToolStart ignores tool calls that are not intended for it.
            await context.sendJson({ toolCalls, prompt: context.messages.in.content.prompt }, 'tools');

            // Output of each tool is expected to be stored in the service state
            // under the ID of the tool call. This is done in the ToolStartOutput component.
            // Collect outputs of all the required tool calls.
            await context.log({ step: 'collect-tools-output', toolCalls });

            const pollStart = Date.now();
            while (
                (outputs.length < toolCalls.length) &&
                (Date.now() - pollStart < COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT)
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
            await context.log({ step: 'collected-tools-output', outputs });
        }

        return outputs;
    },

    agent: async function(context, client, instructions, model, prompt, tools, history) {

        const messages = history || [{
            // Note that we're not using the 'system' role here since it's not
            // supported by all models. For example, o1 models.
            role: 'user',
            content: instructions
        }];

        messages.push({
            role: 'user',
            content: prompt
        });

        for (let i = 0; i < context.config.AI_AGENT_MAX_ATTEMPTS || MAX_ATTEMPTS; i++) {

            const completion = {
                model,
                messages,
                tools
            };
            await context.log({ step: 'agent-completion', completion });
            const choice = await this.createCompletion(context, client, completion);
            const { finish_reason: finishReason, message } = choice;
            messages.push(message);

            if (finishReason === 'tool_calls' && message.tool_calls) {

                const outputs = await this.callTools(context, message.tool_calls);
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
        return { messages, answer: 'The maximum number of iterations has been met without a suitable answer. Please try again with a more specific input.' };
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

        const choice = await this.createCompletion(context, client, {
            model,
            messages: [{
                role: 'user',
                content: 'Summarize the following conversation:\n' + JSON.stringify(history, null, 2)
            }],
            max_tokens: context.config.AI_AGENT_MAX_HISTORY_SUMMARY_TOKENS || 1000
        });

        const { message } = choice;
        return message.content;
    },

    receive: async function(context) {

        const receiveStart = new Date;
        const { prompt, storeId, threadId } = context.messages.in.content;
        if (!threadId) {
            threadId = context.messages.in.correlationId;
        }
        const model = context.properties.model;
        const apiKey = context.auth.apiKey;
        const opt = { apiKey };
        if (context.config.llmBaseUrl) {
            // Allow for re-using the OpenAI connector with different OpenAI compatible LLMs.
            // For example, for OpenRouter, set 'https://openrouter.ai/api/v1'.
            opt.baseUrl = context.config.llmBaseUrl;
        }
        if (context.config.llmDefaultHeaders) {
            // For example, for OpenRouter, set:
            // {
            //    'HTTP-Referer': '<YOUR_SITE_URL>', // Optional. Site URL for rankings on openrouter.ai.
            //    'X-Title': '<YOUR_SITE_NAME>', // Optional. Site title for rankings on openrouter.ai.
            // }
            try {
                opt.defaultHeaders = JSON.parse(context.config.llmDefaultHeaders);
            } catch (err) {
                return context.CancelError('Invalid JSON in config.llmDefaultHeaders: ' + err.message);
            }
        }
        const client = new OpenAI(opt);
        let tools = await context.stateGet('tools');
        if (!tools) {
            // If agent is started with OnStart component, the start method might not
            // have been executed yet. So we need to collect tools on-demand here.
            tools = await this.collectTools(context);
        }

        // Check if a thread with a given ID exists.
        let history;
        if (threadId) {
            history = await this.loadSummary(context, storeId, threadId);
        }
        const historyLength = history.length;
        const agentTimeStart = new Date;
        const response = await this.agent(
            context,
            client,
            context.properties.instructions || 'You\'re a helpful assistant.',
            model,
            prompt,
            tools,
            history
        );
        await context.log({ step: 'agent-response', response, time: (new Date) - agentTimeStart });

        const newMessages = response.messages.slice(historyLength);
        await this.saveMessages(context, storeId, threadId, newMessages);
        let newHistory = response.messages;
        const newHistoryText = JSON.stringify(newHistory);
        if (newHistoryText.length > (context.config.AI_AGENT_MAX_HISTORY_SIZE || 512000)) {
            // Limit the history size to around 512kB by default.
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
        }
        await this.saveSummary(context, storeId, threadId, newHistory);

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
