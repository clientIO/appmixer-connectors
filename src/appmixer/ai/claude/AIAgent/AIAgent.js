/* eslint-disable camelcase */

const lib = require('../lib.js');
const componentTool = require('../tool');

const COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT = 60 * 1000;  // 60 seconds
const COLLECT_TOOL_OUTPUTS_POLL_INTERVAL = 1 * 1000;  // 1 second
// How long a timed-out ToolStart call is remembered, so that its late ToolOutput can be removed from the flow state.
const LATE_TOOL_OUTPUT_TTL = 60 * 60 * 1000;  // 1 hour
// Room for extended thinking: newer models spend part of max_tokens on thinking before they answer.
const DEFAULT_MAX_TOKENS = 8192;
// The Claude 3 models (not 3.5 / 3.7) answer at most 4096 tokens and refuse a higher max_tokens.
const CLAUDE_3_MAX_TOKENS = 4096;
const MAX_TURNS = 20; // Messages API calls for one prompt before the agent gives up.

/**
 * A tool definition of tool.js (function-calling shape, shared with the OpenAI agent) as an
 * Anthropic tool. A component without model-defined fields has no `parameters`, while the
 * Messages API requires an `input_schema` on every tool.
 */
function toAnthropicTool(def) {

    const fn = componentTool.toPublicToolDef(def).function;
    return {
        name: fn.name,
        description: fn.description,
        input_schema: fn.parameters || { type: 'object', properties: {} }
    };
}

module.exports = {

    start: async function(context) {
        await this.collectTools(context);
    },

    /**
     * Tools of the agent: ToolStart chains on the 'tools' port and components on the 'tool' port.
     * 'functionDeclarations' is written last, so once it is in the state, 'componentTools' is too.
     */
    collectTools: async function(context) {
        try {
            const tools = lib.getConnectedToolStartComponents(context.componentId, context.flowDescriptor);
            const functionDeclarations = lib.getFunctionDeclarations(tools);
            // Components wired to the 'tool' port are tools on their own, with no
            // 'ToolStart'/'ToolOutput' chain around them (cached to state as 'componentTools').
            const componentToolDefs = await componentTool.collectComponentTools(context);
            await context.stateSet('functionDeclarations', functionDeclarations);
            return { functionDeclarations, componentToolDefs };
        } catch (error) {
            throw new context.CancelError(error.message || error);
        }
    },

    receive: async function(context) {
        const { prompt, model, instructions } = context.messages.in.content;
        // max_tokens: the name before the input was declared
        const { maxTokens: maxTokensInput, max_tokens: legacyMaxTokens } = context.messages.in.content;
        const maxTokens = Number(maxTokensInput || legacyMaxTokens)
            || (/^claude-3-(haiku|opus|sonnet)/.test(model) ? CLAUDE_3_MAX_TOKENS : DEFAULT_MAX_TOKENS);
        if (!prompt) {
            throw new context.CancelError('Prompt is required');
        }

        if (!model) {
            throw new context.CancelError('Model is required');
        }


        const threadId = context.messages.in.content.threadId;
        const correlationId = context.messages.in.correlationId;

        let functionDeclarations = await context.stateGet('functionDeclarations');
        let componentToolDefs;
        if (functionDeclarations) {
            componentToolDefs = await componentTool.getComponentToolDefs(context);
        } else {
            // A message from OnStart can arrive before start() has stored the tools.
            ({ functionDeclarations, componentToolDefs } = await this.collectTools(context));
        }
        const tools = functionDeclarations.concat(componentToolDefs.map(toAnthropicTool));
        await this.removeLateToolOutputs(context);
        let system = instructions || 'You are a helpful assistant. If you detect you cannot use any tool, always reply directly as if no tools were given to you.';
        let messages = threadId ? await context.stateGet(`history:${threadId}`) || [] : [];
        messages.push({ role: 'user', content: prompt });
        if (threadId) {
            await context.stateSet(`history:${threadId}`, messages);
        }

        // Token usage summed over all Messages API calls made while answering this prompt.
        let usage;

        for (let turn = 1; ; turn++) {
            await context.log({ step: 'turn', turn, messages });

            // Prepare the request to Anthropic
            const requestData = {
                system,
                messages,
                max_tokens: maxTokens,
                model
            };
            if (tools.length) {
                requestData.tools = tools;
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
            usage = lib.addUsage(usage, data?.usage);

            // Every tool_use block of the turn needs its tool_result in the next user message,
            // otherwise the Messages API rejects the request.
            const toolUses = (data?.content || []).filter(part => part.type === 'tool_use' && part.id && part.name);
            if (toolUses.length) {
                if (turn >= MAX_TURNS) {
                    throw new context.CancelError(`The agent still asked for tools after ${MAX_TURNS} turns.`);
                }
                messages.push({ role: 'assistant', content: data.content });
                await context.log({ step: 'function-calls', message: `AI requested ${toolUses.length} function(s)`, functionCalls: toolUses });

                const results = [];
                // One call at a time: a ToolStart keeps one call in flight per correlation ID.
                for (const toolUse of toolUses) {
                    const output = await this.callTool(context, toolUse, componentToolDefs, { prompt, correlationId });
                    results.push(output === undefined
                        ? { type: 'tool_result', tool_use_id: toolUse.id, content: 'The tool returned no output in time.', is_error: true }
                        : { type: 'tool_result', tool_use_id: toolUse.id, content: typeof output === 'string' ? output : JSON.stringify(output) });
                }
                await context.log({ step: 'tool-outputs', results });
                messages.push({ role: 'user', content: results });
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
                return context.sendJson({
                    answer,
                    prompt,
                    usage,
                    stop_reason: data?.stop_reason,
                    model: data?.model
                }, 'out');
            }
        }
    },

    /**
     * Runs one tool call and returns its output, or undefined when a ToolStart chain did not
     * deliver one in time. A tool on the 'tool' port (component or MCP server) is called
     * directly; its errors come back as the output text for the model to deal with.
     */
    callTool: async function(context, toolUse, componentToolDefs, { prompt, correlationId }) {

        const componentToolDef = componentToolDefs.find(def => def.function.name === toolUse.name);
        if (componentToolDef) {
            return componentTool.executeComponentTool(context, componentToolDef, toolUse.input, { correlationId });
        }

        // A ToolStart chain on the 'tools' port: hand the call over and wait for its ToolOutput.
        const call = {
            componentId: toolUse.name.split('_')[1],
            args: toolUse.input,
            id: `${toolUse.id}:${correlationId}`,
            name: toolUse.name
        };
        await context.sendJson({ toolCalls: [call], prompt }, 'tools');
        await context.log({ step: 'collect-tools-output', call });
        const pollStart = Date.now();
        while (Date.now() - pollStart < COLLECT_TOOL_OUTPUTS_POLL_TIMEOUT) {
            const result = await context.flow.stateGet(call.id);
            if (result) {
                await context.flow.stateUnset(call.id);
                return result.output;
            }
            await new Promise((resolve) => setTimeout(resolve, COLLECT_TOOL_OUTPUTS_POLL_INTERVAL));
        }
        await context.log({ step: 'no-tool-output', call });
        // Its ToolOutput can still come and would stay in the flow state: remember the key.
        const late = await context.stateGet('lateToolOutputs') || [];
        await context.stateSet('lateToolOutputs', late.concat({ id: call.id, at: Date.now() }));
        return undefined;
    },

    /** Removes the ToolOutput results that came after their call had timed out. */
    removeLateToolOutputs: async function(context) {

        const late = await context.stateGet('lateToolOutputs');
        if (!late?.length) {
            return;
        }
        const waiting = [];
        for (const call of late) {
            if (await context.flow.stateGet(call.id)) {
                await context.flow.stateUnset(call.id);
            } else if (Date.now() - call.at < LATE_TOOL_OUTPUT_TTL) {
                waiting.push(call);
            }
        }
        await context.stateSet('lateToolOutputs', waiting);
    }
};
