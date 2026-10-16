'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { createMockContext } = require('../../../../../../test/utils');

const AIAgent = require('../../AIAgent/AIAgent');

describe('AIAgent - mcpCallTool', () => {

    let sandbox;

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should pass correlationId from context.messages.in.correlationId to mcpCallTool', async () => {

        const context = createMockContext({
            flowId: 'test-flow-id',
            componentId: 'test-component-id',
            messages: {
                in: {
                    correlationId: 'test-correlation-id-123'
                }
            },
            httpRequest: sandbox.stub().resolves({
                data: {
                    result: 'success'
                }
            })
        });

        await AIAgent.mcpCallTool(context, 'mcp-component-id', 'testTool', { arg1: 'value1' });

        assert(context.httpRequest.calledOnce, 'httpRequest should be called once');

        const callArgs = context.httpRequest.firstCall.args[0];
        assert.strictEqual(callArgs.data.correlationId, 'test-correlation-id-123', 'correlationId should be passed in request data');
    });

    it('should pass tool name and arguments to mcpCallTool', async () => {

        const context = createMockContext({
            flowId: 'test-flow-id',
            componentId: 'test-component-id',
            messages: {
                in: {
                    correlationId: 'correlation-123'
                }
            },
            httpRequest: sandbox.stub().resolves({
                data: {
                    result: 'success'
                }
            })
        });

        const toolName = 'myTool';
        const toolArgs = { param1: 'value1', param2: 'value2' };

        await AIAgent.mcpCallTool(context, 'mcp-component-id', toolName, toolArgs);

        const callArgs = context.httpRequest.firstCall.args[0];
        assert.strictEqual(callArgs.data.name, toolName, 'tool name should be passed correctly');
        assert.deepStrictEqual(callArgs.data.arguments, toolArgs, 'tool arguments should be passed correctly');
    });

    it('should handle missing correlationId gracefully', async () => {

        const context = createMockContext({
            flowId: 'test-flow-id',
            componentId: 'test-component-id',
            messages: {
                in: {}
            },
            httpRequest: sandbox.stub().resolves({
                data: {
                    result: 'success'
                }
            })
        });

        await AIAgent.mcpCallTool(context, 'mcp-component-id', 'testTool', { arg1: 'value1' });

        const callArgs = context.httpRequest.firstCall.args[0];
        assert.strictEqual(callArgs.data.correlationId, undefined, 'correlationId should be undefined when not provided');
    });

    it('should handle null correlationId gracefully', async () => {

        const context = createMockContext({
            flowId: 'test-flow-id',
            componentId: 'test-component-id',
            messages: {
                in: {
                    correlationId: null
                }
            },
            httpRequest: sandbox.stub().resolves({
                data: {
                    result: 'success'
                }
            })
        });

        await AIAgent.mcpCallTool(context, 'mcp-component-id', 'testTool', { arg1: 'value1' });

        const callArgs = context.httpRequest.firstCall.args[0];
        assert.strictEqual(callArgs.data.correlationId, null, 'correlationId should be null when explicitly set to null');
    });

    it('should construct correct API URL for mcpCallTool', async () => {

        const context = createMockContext({
            flowId: 'flow-123',
            componentId: 'component-456',
            messages: {
                in: {
                    correlationId: 'corr-789'
                }
            },
            httpRequest: sandbox.stub().resolves({
                data: {
                    result: 'success'
                }
            })
        });

        process.env.APPMIXER_API_URL = 'https://api.example.com';

        await AIAgent.mcpCallTool(context, 'mcp-component-id', 'testTool', {});

        const callArgs = context.httpRequest.firstCall.args[0];
        assert(callArgs.url.includes('flow-123'), 'URL should contain flow ID');
        assert(callArgs.url.includes('mcp-component-id'), 'URL should contain component ID');
        assert.strictEqual(callArgs.method, 'POST', 'method should be POST');
    });

    it('should return the response data from mcpCallTool', async () => {

        const expectedData = {
            toolResult: 'output from tool',
            status: 'success'
        };

        const context = createMockContext({
            flowId: 'test-flow-id',
            componentId: 'test-component-id',
            messages: {
                in: {
                    correlationId: 'test-correlation-id'
                }
            },
            httpRequest: sandbox.stub().resolves({
                data: expectedData
            })
        });

        const result = await AIAgent.mcpCallTool(context, 'mcp-component-id', 'testTool', {});

        assert.deepStrictEqual(result, expectedData, 'should return the response data');
    });
});

describe('AIAgent - isMCPserver', () => {

    it('should return true for MCP server component', () => {

        const context = {
            flowDescriptor: {
                'mcp-comp-1': {
                    type: 'appmixer.mcpservers.MCPServer'
                }
            }
        };

        const result = AIAgent.isMCPserver(context, 'mcp-comp-1');
        assert.strictEqual(result, true, 'should return true for MCP server component');
    });

    it('should return false for non-MCP server component', () => {

        const context = {
            flowDescriptor: {
                'normal-comp-1': {
                    type: 'appmixer.ai.agenttools.ToolStart'
                }
            }
        };

        const result = AIAgent.isMCPserver(context, 'normal-comp-1');
        assert.strictEqual(result, false, 'should return false for non-MCP server component');
    });

    it('should return false when component does not exist', () => {

        const context = {
            flowDescriptor: {}
        };

        const result = AIAgent.isMCPserver(context, 'non-existent-comp');
        assert.strictEqual(result, false, 'should return false when component does not exist');
    });
});

describe('AIAgent - instructions', () => {

    const INSTRUCTIONS = 'Answer in plain text only.';

    let sandbox;
    let context;
    let createCompletion;

    beforeEach(async () => {
        context = createMockContext({
            auth: { apiKey: 'test-api-key' },
            properties: { instructions: INSTRUCTIONS, model: 'gpt-4o' },
            messages: { in: { correlationId: 'corr-1', content: { prompt: 'First question' } } }
        });
        // No tools, so receive() does not collect them from the flow descriptor.
        await context.stateSet('tools', []);

        sandbox = sinon.createSandbox();
        sandbox.stub(AIAgent, 'publishChatProgressEvent').resolves();
        createCompletion = sandbox.stub(AIAgent, 'createCompletion').callsFake(async (ctx, client, completion) => {
            return {
                finish_reason: 'stop',
                message: { role: 'assistant', content: `Answer ${completion.messages.length}` }
            };
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should send the instructions ahead of the prompt', async () => {

        await AIAgent.receive(context);

        const { messages } = createCompletion.firstCall.args[2];
        assert.deepStrictEqual(messages, [
            { role: 'user', content: INSTRUCTIONS },
            { role: 'user', content: 'First question' }
        ]);
    });

    it('should prefer the instructions from the input port', async () => {

        context.messages.in.content.instructions = 'Answer in Czech.';

        await AIAgent.receive(context);

        const { messages } = createCompletion.firstCall.args[2];
        assert.deepStrictEqual(messages[0], { role: 'user', content: 'Answer in Czech.' });
    });

    it('should send the instructions once per request in a thread and keep them out of its history', async () => {

        context.messages.in.content.threadId = 'thread-1';
        await AIAgent.receive(context);

        context.messages.in.content.prompt = 'Second question';
        await AIAgent.receive(context);

        const { messages } = createCompletion.secondCall.args[2];
        assert.deepStrictEqual(messages, [
            { role: 'user', content: INSTRUCTIONS },
            { role: 'user', content: 'First question' },
            { role: 'assistant', content: 'Answer 2' },
            { role: 'user', content: 'Second question' }
        ]);

        const history = JSON.parse(await context.stateGet('thread_summary_thread-1'));
        assert.strictEqual(history.length, 4);
        assert(history.every((message) => message.content !== INSTRUCTIONS), 'instructions should not be stored');
    });
});

describe('AIAgent - history summary', () => {

    let sandbox;
    let context;
    let createCompletion;

    beforeEach(async () => {
        context = createMockContext({
            auth: { apiKey: 'test-api-key' },
            properties: { model: 'gpt-4o' },
            messages: { in: { correlationId: 'corr-1', content: { prompt: 'Question', threadId: 'thread-1' } } }
        });
        // Any exchange is over this limit, so every turn ends with a summary.
        context.config = { AI_AGENT_MAX_HISTORY_SIZE: 10 };
        await context.stateSet('tools', []);

        sandbox = sinon.createSandbox();
        sandbox.stub(AIAgent, 'publishChatProgressEvent').resolves();
        createCompletion = sandbox.stub(AIAgent, 'createCompletion').resolves({
            finish_reason: 'stop',
            message: { role: 'assistant', content: 'Text' }
        });
    });

    afterEach(() => {
        sandbox.restore();
    });

    const summaryRequest = () => createCompletion.secondCall.args[2];

    it('should not cap the summary unless a cap is configured', async () => {

        await AIAgent.receive(context);

        assert.deepStrictEqual(Object.keys(summaryRequest()), ['model', 'messages']);
    });

    it('should send a configured cap as max_completion_tokens to OpenAI', async () => {

        context.config.AI_AGENT_MAX_HISTORY_SUMMARY_TOKENS = 500;

        await AIAgent.receive(context);

        assert.strictEqual(summaryRequest().max_completion_tokens, 500);
        assert.strictEqual(summaryRequest().max_tokens, undefined);
    });

    it('should send a configured cap as max_tokens to another OpenAI compatible LLM', async () => {

        context.config.AI_AGENT_MAX_HISTORY_SUMMARY_TOKENS = 500;
        context.config.llmBaseUrl = 'https://llm.example.com/v1';

        await AIAgent.receive(context);

        assert.strictEqual(summaryRequest().max_tokens, 500);
        assert.strictEqual(summaryRequest().max_completion_tokens, undefined);
    });

    it('should still send the answer when the summary fails', async () => {

        createCompletion.onSecondCall().rejects(new Error('400 Unsupported parameter'));

        await AIAgent.receive(context);

        assert.strictEqual(context.sendJson.firstCall.args[0].answer, 'Text');
        assert.strictEqual(JSON.parse(await context.stateGet('thread_summary_thread-1')).length, 2);
    });
});
