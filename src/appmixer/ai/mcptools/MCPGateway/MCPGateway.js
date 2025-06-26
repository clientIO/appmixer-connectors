'use strict';

const shortuuid = require('short-uuid');
const uuid = require('uuid');

const TOOLS_OUTPUT_POLL_TIMEOUT = 2 * 60 * 1000;  // 120 seconds
const TOOLS_OUTPUT_POLL_INTERVAL = 300;  // 300ms

module.exports = {

    start: async function(context) {

        const tools = await this.collectTools(context);
        await context.service.stateAddToSet(`user:${context.userId}`, {
            flowId: context.flowId,
            componentId: context.componentId,
            tools,
            webhook: context.getWebhookUrl()
        });
        return context.callAppmixer({
            endPoint: '/plugins/appmixer/ai/mcptools/gateways',
            method: 'POST',
            body: {}
        });
    },

    stop: async function(context) {

        const tools = await context.stateGet('tools');
        await context.service.stateRemoveFromSet(`user:${context.userId}`, {
            flowId: context.flowId,
            componentId: context.componentId,
            tools,
            webhook: context.getWebhookUrl()
        });
        return context.callAppmixer({
            endPoint: '/plugins/appmixer/ai/mcptools/gateways/' + context.componentId,
            method: 'DELETE'
        });
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
            let toolName = (component.label || component.type.split('.').pop());
            toolName = toolName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 64 - componentId.length - 1);
            const toolDefinition = {
                type: 'function',
                function: {
                    name: componentId + '_' + toolName,
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

    callTool: async function(context, componentId, args) {

        const toolCall = {
            componentId,
            args,
            id: context.messages.webhook.correlationId
        };
        const toolCalls = [toolCall];
        // Send to all tools. Each ai.ToolStart ignores tool calls that are not intended for it.
        await context.sendJson({ toolCalls }, 'tools');
        // Output of each tool is expected to be stored in the service state
        // under the ID of the tool call. This is done in the ToolStartOutput component.
        // Collect outputs of all the required tool calls.
        await context.log({ step: 'collect-tools-output', toolCalls });

        const pollStart = Date.now();
        const pollTimeout = context.config.TOOLS_OUTPUT_POLL_TIMEOUT || TOOLS_OUTPUT_POLL_TIMEOUT;
        const pollInterval = context.config.TOOLS_OUTPUT_POLL_INTERVAL || TOOLS_OUTPUT_POLL_INTERVAL;
        while ((Date.now() - pollStart) < pollTimeout) {
            const result = await context.flow.stateGet(toolCall.id);
            if (result) {
                await context.flow.stateUnset(toolCall.id);
                return result.output;
            }
            // Sleep.
            await new Promise((resolve) => setTimeout(resolve, pollInterval));
        }
        return 'Error: Tool timed out.';
    },

    receive: async function(context) {

        if (context.messages.webhook) {

            const req = context.messages.webhook.content;
            let componentId = req.data.function.name.split('_')[0];
            const toolName = req.data.function.name.split('_').slice(1).join('_');
            const args = typeof req.data.function.arguments === 'string' ? JSON.parse(req.data.function.arguments) : req.data.function.arguments;
            if (!uuid.validate(componentId)) {
                // Short version of the UUID.
                // Get back the original compoennt UUID back from the short version.
                componentId = shortuuid().toUUID(componentId);
            }
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
                    await context.log({ step: 'call-tool-error', componentId, toolName, err });
                    output = `Error calling tool ${toolName}: ${err.message}`;
                }
                output = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                return context.response(output, 200);
            } else {
                let output = await this.callTool(context, componentId, args);
                output = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
                return context.response(output, 200);
            }
        }
    }
};
