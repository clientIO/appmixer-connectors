/* eslint-disable camelcase */

const lib = require('../lib.js');
const componentTool = require('../tool');

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
     * Everything wired to the 'tools' port is a tool: a 'Tool Start' chain, an action component
     * (the fields mapped to 'Model Defined Parameter' become its parameters) with the components
     * behind it as further steps, or an MCP server. See tool.js.
     */
    collectTools: async function(context) {
        try {
            const toolDefs = await componentTool.collectComponentTools(context);
            await context.stateSet('toolsCollected', true);
            return toolDefs;
        } catch (error) {
            throw new context.CancelError(error.message || error);
        }
    },

    getTools: async function(context) {
        if (!await context.stateGet('toolsCollected')) {
            // A message from OnStart can arrive before start() has stored the tools.
            return this.collectTools(context);
        }
        return componentTool.getComponentToolDefs(context);
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

        const toolDefs = await this.getTools(context);
        const tools = toolDefs.map(toAnthropicTool);
        // A Tool Output that came after its call had timed out would stay in the flow state.
        await componentTool.removeLateToolOutputs(context);
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

                // Different tools run at once, calls of one Tool Start one after the other. A failure
                // or a timeout comes back as the output text for the model to deal with.
                const outputs = await componentTool.executeToolCalls(context, toolDefs,
                    toolUses.map((toolUse) => ({ id: toolUse.id, name: toolUse.name, args: toolUse.input })),
                    { correlationId });
                const results = outputs.map(({ id, output }) => ({ type: 'tool_result', tool_use_id: id, content: output }));
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
    }
};
