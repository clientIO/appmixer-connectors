'use strict';

const { createClient, parseToolResult } = require('../../mcp-commons');

/**
 * AI-powered MCP tool caller.
 *
 * This component uses an LLM to:
 * 1. Discover available tools from the MCP server
 * 2. Select the appropriate tool(s) based on a natural language prompt
 * 3. Generate tool arguments
 * 4. Execute tool calls
 * 5. Summarize results
 *
 * It acts as an AI agent that can chain multiple tool calls to fulfill complex requests.
 *
 * NOTE: This is a scaffold. The actual LLM integration depends on the AI infrastructure
 * available in the Appmixer instance (e.g., OpenAI API, Anthropic API, or Appmixer's
 * built-in AI capabilities). The implementation below uses a simple prompt-based approach
 * that should be adapted to the specific AI provider.
 */
module.exports = {

    async receive(context) {

        const { prompt, context: additionalContext } = context.messages.in.content;
        const maxSteps = context.properties.maxSteps || 3;

        const client = createClient(context);

        // Initialize MCP session
        await client.initialize(context.httpRequest.bind(context));

        // Get available tools
        const tools = await client.listAllTools(context.httpRequest.bind(context));

        // Build tool descriptions for the AI
        const toolDescriptions = tools.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));

        const steps = [];
        const results = [];
        const toolsCalled = [];

        // Simple single-step execution: find matching tool and call it
        // For full AI agent loop, integrate with an LLM provider here
        const matchedTool = findBestToolMatch(prompt, tools);

        if (matchedTool) {
            try {
                const args = extractArgsFromPrompt(prompt, matchedTool);
                const result = await client.callTool(matchedTool.name, args, context.httpRequest.bind(context));
                const parsed = parseToolResult(result);

                toolsCalled.push(matchedTool.name);
                results.push(parsed);
                steps.push({
                    tool: matchedTool.name,
                    args,
                    result: parsed.text,
                    isError: parsed.isError
                });
            } catch (err) {
                steps.push({
                    tool: matchedTool.name,
                    error: err.message
                });
            }
        }

        // Generate answer summary
        const answer = results.length > 0
            ? results.map(r => r.text).join('\n\n')
            : `No matching tool found for: "${prompt}". Available tools: ${tools.map(t => t.name).join(', ')}`;

        return context.sendJson({
            answer,
            toolsCalled,
            results,
            steps
        }, 'out');
    }
};

/**
 * Simple keyword-based tool matching.
 * In a full implementation, this would be replaced by an LLM call that selects
 * the best tool based on the prompt and tool descriptions.
 */
function findBestToolMatch(prompt, tools) {

    const promptLower = prompt.toLowerCase();

    // Score each tool based on keyword overlap
    let bestMatch = null;
    let bestScore = 0;

    for (const tool of tools) {
        let score = 0;
        const nameWords = tool.name.toLowerCase().split(/[_\-\s]+/);
        const descWords = (tool.description || '').toLowerCase().split(/\s+/);

        for (const word of nameWords) {
            if (word.length > 2 && promptLower.includes(word)) {
                score += 3;
            }
        }

        for (const word of descWords) {
            if (word.length > 3 && promptLower.includes(word)) {
                score += 1;
            }
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = tool;
        }
    }

    return bestScore > 0 ? bestMatch : null;
}

/**
 * Simple argument extraction from prompt.
 * In a full implementation, this would be replaced by an LLM call that
 * generates the correct arguments based on the tool's inputSchema.
 */
function extractArgsFromPrompt(prompt, tool) {

    // For now, pass the prompt as a query/search parameter if the tool accepts one
    const schema = tool.inputSchema;
    if (!schema || !schema.properties) return {};

    const args = {};
    const props = schema.properties;

    // Common patterns: look for query/search/filter/name type parameters
    const queryKeys = ['query', 'search', 'filter', 'q', 'name', 'email', 'term'];
    for (const key of queryKeys) {
        if (props[key]) {
            args[key] = prompt;
            break;
        }
    }

    return args;
}
