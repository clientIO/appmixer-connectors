'use strict';

const assert = require('assert');
const sinon = require('sinon');
const shortuuid = require('short-uuid');
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

describe('AIAgent - tool port', () => {

    const AGENT_ID = 'agent-1';
    const TOOL_NAME = 'rows-1_Employee_contacts';

    let sandbox;
    let context;

    beforeEach(() => {
        context = createMockContext({
            componentId: AGENT_ID,
            messages: { in: { correlationId: 'corr-1', content: { prompt: 'Who is the CEO?' } } },
            flowDescriptor: {
                [AGENT_ID]: { type: 'appmixer.ai.openai.AIAgent' },
                'rows-1': {
                    type: 'appmixer.google.spreadsheets.GetRows',
                    label: 'Employee contacts',
                    source: { in: { [AGENT_ID]: ['tools'] } },
                    config: {
                        transform: {
                            in: {
                                [AGENT_ID]: {
                                    tools: {
                                        modifiers: {
                                            sheetId: {},
                                            filter: {
                                                'var-1': {
                                                    variable: `$.${AGENT_ID}.tools.modelDefinedParameter`,
                                                    functions: []
                                                }
                                            }
                                        },
                                        lambda: { sheetId: 'sheet-1', filter: '{{{var-1}}}' }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        });
        context.callAppmixer = sinon.stub().callsFake(async ({ endPoint }) => {
            if (endPoint.startsWith('/components?selector=')) {
                return [{
                    name: 'appmixer.google.spreadsheets.GetRows',
                    description: 'Get rows from a sheet.',
                    inPorts: [{
                        name: 'in',
                        schema: {
                            type: 'object',
                            properties: { sheetId: { type: 'string' }, filter: { type: 'string' } },
                            required: ['sheetId']
                        },
                        inspector: { inputs: { filter: { label: 'Filter', tooltip: 'Rows to return.' } } }
                    }]
                }];
            }
            return { rows: [['Jane Doe', 'CEO']] };
        });

        sandbox = sinon.createSandbox();
        sandbox.stub(AIAgent, 'publishChatProgressEvent').resolves();
    });

    afterEach(() => {
        sandbox.restore();
    });

    it('should expose a component wired to the tool port as a tool', async () => {

        const tools = await AIAgent.getAllToolsDefinition(context);

        assert.deepStrictEqual(tools, [{
            type: 'function',
            function: {
                name: TOOL_NAME,
                description: 'Employee contacts - Get rows from a sheet.',
                parameters: {
                    type: 'object',
                    properties: { filter: { type: 'string', description: 'Filter — Rows to return.' } }
                }
            }
        }]);
    });

    it('should call the component directly with the model arguments and the static values', async () => {

        await AIAgent.getAllToolsDefinition(context);

        const outputs = await AIAgent.callTools(context, [{
            id: 'call-1',
            function: { name: TOOL_NAME, arguments: '{"filter":"CEO","sheetId":"other"}' }
        }]);

        assert.deepStrictEqual(outputs, [{
            tool_call_id: 'call-1',
            output: JSON.stringify({ rows: [['Jane Doe', 'CEO']] }, null, 2)
        }]);
        const call = context.callAppmixer.lastCall.args[0];
        assert.strictEqual(call.endPoint, '/component/appmixer/google/spreadsheets/GetRows');
        assert.deepStrictEqual(call.body, {
            componentId: 'rows-1',
            messages: { in: { filter: 'CEO', sheetId: 'sheet-1' } }
        });
        assert(context.sendJson.notCalled, 'nothing should be sent to the tools port');
    });

    it('should describe an array input with its items and a select with its options', async () => {

        const manifest = (await context.callAppmixer({ endPoint: '/components?selector=x' }))[0];
        manifest.inPorts[0].schema.properties.filter = { type: 'array' };
        manifest.inPorts[0].schema.properties.sheetId = { type: 'string', enum: ['sheet-1', 'sheet-2'] };
        context.callAppmixer = sinon.stub().resolves([manifest]);
        const transform = context.flowDescriptor['rows-1'].config.transform.in[AGENT_ID].tools;
        transform.modifiers.sheetId = transform.modifiers.filter;

        const [tool] = await AIAgent.getAllToolsDefinition(context);

        assert.deepStrictEqual(tool.function.parameters.properties.filter.items, {});
        assert.deepStrictEqual(tool.function.parameters.properties.sheetId.enum, ['sheet-1', 'sheet-2']);
    });

    it('should send the properties set on the component along with the call', async () => {

        const manifest = (await context.callAppmixer({ endPoint: '/components?selector=x' }))[0];
        manifest.properties = { schema: { properties: { range: { type: 'string' } } } };
        context.callAppmixer = sinon.stub().callsFake(async ({ endPoint }) => {
            return endPoint.startsWith('/components?selector=') ? [manifest] : {};
        });
        // Only the declared properties are sent, the engine validates them against the schema.
        context.flowDescriptor['rows-1'].config.properties = { range: 'A1:B9', account: 'account-1' };

        await AIAgent.getAllToolsDefinition(context);
        await AIAgent.callTools(context, [{ id: 'call-1', function: { name: TOOL_NAME, arguments: '{}' } }]);

        assert.deepStrictEqual(context.callAppmixer.lastCall.args[0].body.properties, { range: 'A1:B9' });
    });

    it('should resolve a variable inside an object value', async () => {

        const transform = context.flowDescriptor['rows-1'].config.transform.in[AGENT_ID].tools;
        transform.modifiers.sheetId = { 'var-2': { variable: '$.trigger-1.out.sheet', functions: [] } };
        transform.lambda.sheetId = { AND: [{ field: 'id', value: '{{{var-2}}}' }, { field: 'kind', value: 'sheet' }] };
        context.messages.in.scope = { 'trigger-1': { out: { sheet: 'sheet-9' } } };
        const callAppmixer = context.callAppmixer;
        context.callAppmixer = sinon.stub().callsFake(async (request) => {
            return request.endPoint === '/modifiers/transform' ? { result: 'sheet-9' } : callAppmixer(request);
        });

        await AIAgent.getAllToolsDefinition(context);
        await AIAgent.callTools(context, [{ id: 'call-1', function: { name: TOOL_NAME, arguments: '{"filter":"CEO"}' } }]);

        assert.deepStrictEqual(context.callAppmixer.lastCall.args[0].body.messages.in, {
            sheetId: { AND: [{ field: 'id', value: 'sheet-9' }, { field: 'kind', value: 'sheet' }] },
            filter: 'CEO'
        });
    });

    it('should tell the model when a variable refers to an output the engine did not pass on', async () => {

        const transform = context.flowDescriptor['rows-1'].config.transform.in[AGENT_ID].tools;
        transform.modifiers.sheetId = { 'var-2': { variable: '$.trigger-1.out.sheet', functions: [] } };
        transform.lambda.sheetId = '{{{var-2}}}';
        // What the engine leaves in the scope of an output over its size limit.
        context.messages.in.scope = { 'trigger-1': { out: null }, _storedScopes: { 'trigger-1': { out: 'scope-1' } } };

        await AIAgent.getAllToolsDefinition(context);
        const callsBefore = context.callAppmixer.callCount;
        const outputs = await AIAgent.callTools(context, [{
            id: 'call-1',
            function: { name: TOOL_NAME, arguments: '{"filter":"CEO"}' }
        }]);

        assert.match(outputs[0].output, /output 'out' of component trigger-1 is too large/);
        assert.strictEqual(context.callAppmixer.callCount, callsBefore, 'the component should not be called');
    });

    it('should not start with a tool that cannot be loaded', async () => {

        context.callAppmixer = sinon.stub().rejects(new Error('503'));

        await assert.rejects(AIAgent.getAllToolsDefinition(context), /Employee contacts .* could not be loaded: 503/);
    });

    it('should not start when an MCP server on the tool port does not list its tools', async () => {

        context.flowDescriptor['mcp-1'] = {
            type: 'appmixer.mcpservers.github.MCPServer',
            source: { in: { [AGENT_ID]: ['tools'] } }
        };
        context.httpRequest = sinon.stub().rejects(new Error('ECONNREFUSED'));

        await assert.rejects(AIAgent.getAllToolsDefinition(context), /MCP server mcp-1 did not list its tools/);
    });

    it('should call a ToolStart next to a component through its webhook route, never through the port', async () => {

        context.flowDescriptor['ts-1'] = {
            type: 'appmixer.ai.agenttools.ToolStart',
            label: 'Weather',
            source: { in: { [AGENT_ID]: ['tools'] } },
            config: { properties: { description: 'Weather in a city.' } }
        };
        context.flow = {
            stateGet: sinon.stub().resolves({ output: 'sunny' }),
            stateUnset: sinon.stub().resolves()
        };
        const tools = await AIAgent.getAllToolsDefinition(context);
        const getRows = context.callAppmixer;
        context.callAppmixer = sinon.stub().callsFake(async (options) => (
            options.endPoint.startsWith('/flows/') ? { message: 'Enqueued.' } : getRows(options)
        ));

        const outputs = await AIAgent.callTools(context, [
            { id: 'call-1', function: { name: 'ts-1_Weather', arguments: '{}' } }
        ]);

        assert.deepStrictEqual(tools.map((tool) => tool.function.name).sort(), [TOOL_NAME, 'ts-1_Weather'].sort());
        assert.deepStrictEqual(outputs, [{ tool_call_id: 'call-1', output: 'sunny' }]);
        const trigger = context.callAppmixer.getCalls().find((call) => call.args[0].endPoint.startsWith('/flows/'));
        assert(trigger, 'the ToolStart was called through its webhook route');
        assert(context.sendJson.notCalled, 'sendJson would run the component tool too');
    });
});

describe('AIAgent - ToolStart chains and MCP servers on the tools and mcp ports', () => {

    const AGENT_ID = '11111111-1111-4111-8111-111111111111';
    const TOOL_START_ID = '22222222-2222-4222-8222-222222222222';
    const MCP_ID = '44444444-4444-4444-8444-444444444444';
    // Tool names carry the short form of the component ID.
    const TOOL_START_NAME = `${shortuuid().fromUUID(TOOL_START_ID)}_Get_weather`;
    // The MCP tools carry the short form of the server's component ID.
    const MCP_TOOL_NAME = '9qW3E4QPKWVfwFkC8mcPdq_list_issues';

    let sandbox;
    let context;

    // `port` builds the source the way the flow stores it: the designer writes an array,
    // the flow schema also allows a single port as a string.
    const createContext = (port) => {
        context = createMockContext({
            flowId: 'flow-1',
            componentId: AGENT_ID,
            messages: { in: { correlationId: 'corr-1', content: { prompt: 'What is the weather?' } } },
            config: { TOOLS_OUTPUT_POLL_INTERVAL: 1 },
            flowDescriptor: {
                [AGENT_ID]: { type: 'appmixer.ai.openai.AIAgent' },
                [TOOL_START_ID]: {
                    type: 'appmixer.ai.agenttools.ToolStart',
                    label: 'Get weather',
                    source: { in: { [AGENT_ID]: port('tools') } },
                    config: {
                        properties: {
                            description: 'Weather in a city.',
                            parameters: { ADD: [{ name: 'city', type: 'string', description: 'City' }] }
                        }
                    }
                },
                'output-1': {
                    type: 'appmixer.ai.agenttools.ToolOutput',
                    source: { in: { [TOOL_START_ID]: port('out') } }
                },
                [MCP_ID]: { type: 'appmixer.mcpservers.github.MCPServer', source: { in: { [AGENT_ID]: port('mcp') } } }
            }
        });
        context.httpRequest = sinon.stub().callsFake(async ({ url }) => ({
            data: url.includes('listTools') ? [{ name: 'list_issues', description: 'List issues.' }] : { issues: [] }
        }));
        context.callAppmixer = sinon.stub().rejects(new Error('no static call is expected'));
        // ToolOutput stores the output of a tool call in the flow state.
        context.flow = {
            stateGet: sinon.stub().resolves({ output: 'sunny' }),
            stateUnset: sinon.stub().resolves()
        };
    };

    beforeEach(() => {
        sandbox = sinon.createSandbox();
    });

    afterEach(() => {
        sandbox.restore();
    });

    [
        ['an array', (name) => [name]],
        ['a string', (name) => name]
    ].forEach(([shape, port]) => {

        it(`should keep the tools of both ports as they were, with the ports stored as ${shape}`, async () => {

            createContext(port);
            sandbox.stub(AIAgent, 'publishChatProgressEvent').resolves();

            const tools = await AIAgent.getAllToolsDefinition(context);

            assert.deepStrictEqual(tools.map((tool) => tool.function.name), [
                TOOL_START_NAME,
                MCP_TOOL_NAME
            ]);
            assert.deepStrictEqual(tools[0].function.parameters, {
                type: 'object',
                properties: { city: { type: 'string', description: 'City' } },
                required: ['city']
            });
            assert(context.callAppmixer.notCalled, 'a ToolStart needs no manifest');
        });

        it(`should run a ToolStart chain through the port as before, with the ports stored as ${shape}`, async () => {

            createContext(port);
            sandbox.stub(AIAgent, 'publishChatProgressEvent').resolves();
            await AIAgent.getAllToolsDefinition(context);

            const outputs = await AIAgent.callTools(context, [
                { id: 'call-1', function: { name: TOOL_START_NAME, arguments: '{"city":"Brno"}' } },
                { id: 'call-2', function: { name: MCP_TOOL_NAME, arguments: '{}' } }
            ]);

            assert.deepStrictEqual(context.sendJson.firstCall.args, [{
                toolCalls: [{ componentId: TOOL_START_ID, args: { city: 'Brno' }, id: 'call-1:corr-1' }],
                prompt: 'What is the weather?'
            }, 'tools']);
            assert.deepStrictEqual(outputs, [
                { tool_call_id: 'call-1', output: 'sunny' },
                { tool_call_id: 'call-2', output: JSON.stringify({ issues: [] }, null, 2) }
            ]);
            assert(context.callAppmixer.notCalled, 'no static call is expected');
        });
    });
});

describe('AIAgent - tool port with a chain of components', () => {

    const AGENT_ID = 'agent-1';
    const TOOL_NAME = 'emb-1_Search_policies';
    const VECTOR = [0.1, 0.2, 0.3];

    let sandbox;
    let context;
    let componentCalls;
    let transformCalls;
    let embeddingsOutput;

    const toolTransform = (modifiers, lambda) => ({ in: { [AGENT_ID]: { tools: { modifiers, lambda } } } });

    // What the engine's POST /modifiers/transform does, as far as these tests need it.
    const engineTransform = ({ template, modifiers, data }) => {
        const dig = (value, path) => path.split('.').reduce((item, key) => item?.[key], value);
        const resolve = (key) => {
            const { variable, functions } = modifiers[key];
            return functions.reduce(
                (value, fn) => (fn.name === 'g_jsonPath' ? dig(value, fn.params[0].value) : value),
                dig(data.$, variable.replace(/^\$\./, ''))
            );
        };
        const single = /^\{\{\{([^{}]+)\}\}\}$/.exec(template);
        return {
            result: single
                ? resolve(single[1])
                : template.replace(/\{\{\{([^{}]+)\}\}\}/g, (match, key) => String(resolve(key)))
        };
    };

    beforeEach(() => {
        embeddingsOutput = { out: { firstVector: VECTOR } };
        componentCalls = [];
        transformCalls = [];
        context = createMockContext({
            flowId: 'flow-1',
            componentId: AGENT_ID,
            messages: {
                in: {
                    correlationId: 'corr-1',
                    content: { prompt: 'Is there a password policy?' },
                    scope: { 'trigger-1': { out: { channel: 'policies-ns' } } }
                }
            },
            flowDescriptor: {
                'trigger-1': { type: 'appmixer.utils.controls.OnStart' },
                [AGENT_ID]: { type: 'appmixer.ai.openai.AIAgent', source: { in: { 'trigger-1': ['out'] } } },
                'emb-1': {
                    type: 'appmixer.ai.openai.GenerateEmbeddings',
                    label: 'Search policies',
                    source: { in: { [AGENT_ID]: ['tools'] } },
                    config: {
                        transform: toolTransform(
                            {
                                model: {},
                                text: { 'var-1': { variable: `$.${AGENT_ID}.tools.modelDefinedParameter`, functions: [] } }
                            },
                            { model: 'text-embedding-ada-002', text: '{{{var-1}}}' }
                        )
                    }
                },
                'query-1': {
                    type: 'appmixer.pinecone.database.QueryVectors',
                    source: { in: { 'emb-1': ['out'] } },
                    config: {
                        transform: {
                            in: {
                                'emb-1': {
                                    out: {
                                        modifiers: {
                                            index: {},
                                            vector: { 'var-2': { variable: '$.emb-1.out.firstVector', functions: [] } },
                                            namespace: { 'var-3': { variable: '$.trigger-1.out.channel', functions: [] } }
                                        },
                                        lambda: { index: 'policies', vector: '{{{var-2}}}', namespace: '{{{var-3}}}' }
                                    }
                                }
                            }
                        }
                    }
                },
                // The agent's own output must not be taken for a step of the tool.
                'send-1': { type: 'appmixer.utils.controls.SetVariable', source: { in: { [AGENT_ID]: ['out'] } } }
            }
        });
        context.callAppmixer = sinon.stub().callsFake(async ({ endPoint, body }) => {
            if (endPoint.includes('GenerateEmbeddings') && endPoint.startsWith('/components?selector=')) {
                return [{
                    name: 'appmixer.ai.openai.GenerateEmbeddings',
                    description: 'Generate embeddings for a text.',
                    inPorts: [{
                        name: 'in',
                        schema: { type: 'object', properties: { text: { type: 'string' }, model: { type: 'string' } }, required: ['text'] },
                        inspector: { inputs: { text: { label: 'Text', tooltip: 'The text to embed.' } } }
                    }]
                }];
            }
            if (endPoint.startsWith('/components?selector=')) {
                return [{
                    name: 'appmixer.pinecone.database.QueryVectors',
                    description: 'Query Pinecone for vectors.',
                    inPorts: [{ name: 'in', schema: { type: 'object', properties: {} }, inspector: { inputs: {} } }]
                }];
            }
            if (endPoint === '/modifiers/transform') {
                transformCalls.push(body);
                return engineTransform(body);
            }
            componentCalls.push({ endPoint, body });
            return endPoint.endsWith('GenerateEmbeddings')
                ? embeddingsOutput
                : { out: { result: { matches: [{ id: 'chunk-1' }] } } };
        });

        sandbox = sinon.createSandbox();
        sandbox.stub(AIAgent, 'publishChatProgressEvent').resolves();
    });

    afterEach(() => {
        sandbox.restore();
    });

    const callTool = () => AIAgent.callTools(context, [{
        id: 'call-1',
        function: { name: TOOL_NAME, arguments: '{"text":"password policy"}' }
    }]);

    it('should describe the whole chain as one tool', async () => {

        const tools = await AIAgent.getAllToolsDefinition(context);

        assert.deepStrictEqual(tools, [{
            type: 'function',
            function: {
                name: TOOL_NAME,
                description: 'Search policies - Generate embeddings for a text. Then: Query Pinecone for vectors.'
                    + ' The tool runs these steps in a row and returns the output of the last step,'
                    + ' one result for every item when a step returns several.',
                parameters: {
                    type: 'object',
                    properties: { text: { type: 'string', description: 'Text — The text to embed.' } },
                    required: ['text']
                }
            }
        }]);
    });

    it('should feed each step from the previous one and return the output of the last', async () => {

        await AIAgent.getAllToolsDefinition(context);

        const outputs = await callTool();

        assert.deepStrictEqual(componentCalls, [{
            endPoint: '/component/appmixer/ai/openai/GenerateEmbeddings',
            body: { componentId: 'emb-1', messages: { in: { text: 'password policy', model: 'text-embedding-ada-002' } } }
        }, {
            endPoint: '/component/appmixer/pinecone/database/QueryVectors',
            // The vector keeps its type; the namespace comes from a component in front of the agent.
            body: { componentId: 'query-1', messages: { in: { index: 'policies', vector: VECTOR, namespace: 'policies-ns' } } }
        }]);
        assert.deepStrictEqual(outputs, [{
            tool_call_id: 'call-1',
            output: JSON.stringify({ out: { result: { matches: [{ id: 'chunk-1' }] } } }, null, 2)
        }]);
    });

    it('should not run a step whose source port sent nothing', async () => {

        await AIAgent.getAllToolsDefinition(context);
        embeddingsOutput = { notFound: {} };

        const outputs = await callTool();

        assert.strictEqual(componentCalls.length, 1);
        assert.strictEqual(outputs[0].output, JSON.stringify({ notFound: {} }, null, 2));
    });

    it('should let the engine resolve the variables, modifiers included', async () => {

        const namespace = { variable: '$.trigger-1.out', functions: [{ name: 'g_jsonPath', params: [{ value: 'channel' }] }] };
        context.flowDescriptor['query-1'].config.transform.in['emb-1'].out.modifiers.namespace = { 'var-3': namespace };
        await AIAgent.getAllToolsDefinition(context);

        await callTool();

        assert.deepStrictEqual(transformCalls.find((call) => call.template === '{{{var-3}}}'), {
            template: '{{{var-3}}}',
            modifiers: { 'var-3': namespace },
            // Only the outputs the field refers to are sent.
            data: { $: { 'trigger-1': { out: { channel: 'policies-ns' } } } },
            context: { flowId: 'flow-1' }
        });
        assert.strictEqual(componentCalls[1].body.messages.in.namespace, 'policies-ns');
    });

    it('should fill a field of the first component from a variable in front of the agent', async () => {

        const transform = context.flowDescriptor['emb-1'].config.transform.in[AGENT_ID].tools;
        transform.modifiers.text = { 'var-1': { variable: '$.trigger-1.out.channel', functions: [] } };

        const tools = await AIAgent.getAllToolsDefinition(context);
        await AIAgent.callTools(context, [{ id: 'call-1', function: { name: TOOL_NAME, arguments: '{}' } }]);

        assert.strictEqual(tools[0].function.parameters, undefined);
        assert.deepStrictEqual(componentCalls[0].body.messages.in, {
            text: 'policies-ns',
            model: 'text-embedding-ada-002'
        });
    });

    it('should hand a failed variable resolution back to the model as an error', async () => {

        await AIAgent.getAllToolsDefinition(context);
        const callAppmixer = context.callAppmixer;
        context.callAppmixer = sinon.stub().callsFake(async (request) => {
            if (request.endPoint === '/modifiers/transform') throw new Error('transform failed');
            return callAppmixer(request);
        });

        const outputs = await callTool();

        assert.strictEqual(componentCalls.length, 1);
        assert.match(outputs[0].output, /step "QueryVectors": transform failed/);
    });

    describe('when a step sends several messages', () => {

        const match = { out: { result: { matches: [{ id: 'chunk-1' }] } } };

        beforeEach(async () => {
            // What a static call returns for a component that sent two messages to 'out'.
            embeddingsOutput = { out: [{ firstVector: [1] }, { firstVector: [2] }] };
            await AIAgent.getAllToolsDefinition(context);
        });

        it('should run the next step for each of them and return a list', async () => {

            const outputs = await callTool();

            assert.deepStrictEqual(componentCalls.slice(1).map((call) => call.body.messages.in.vector), [[1], [2]]);
            assert.deepStrictEqual(JSON.parse(outputs[0].output), [match, match]);
        });

        it('should keep the other results when one of them fails', async () => {

            const callAppmixer = context.callAppmixer;
            context.callAppmixer = sinon.stub().callsFake(async (request) => {
                if (request.body?.messages?.in?.vector?.[0] === 1) throw new Error('index not found');
                return callAppmixer(request);
            });

            const outputs = await callTool();

            assert.deepStrictEqual(JSON.parse(outputs[0].output), [
                { error: 'Step "QueryVectors" failed: index not found' },
                match
            ]);
        });

        it('should stop at the configured number of items and say so', async () => {

            context.config = { AI_AGENT_TOOL_MAX_ITEMS: 1 };

            const outputs = await callTool();

            assert.deepStrictEqual(JSON.parse(outputs[0].output), [
                match,
                { note: 'Only the first 1 of 2 items were processed.' }
            ]);
        });
    });

    it('should not start when the tool branches', async () => {

        context.flowDescriptor['log-1'] = { type: 'appmixer.utils.controls.SetVariable', source: { in: { 'emb-1': ['out'] } } };

        await assert.rejects(AIAgent.getAllToolsDefinition(context), /connect a .Tool Start. to the\s+.tools. port/);
    });

    it('should turn a model defined field of a later step into a tool parameter', async () => {

        const transform = context.flowDescriptor['query-1'].config.transform.in['emb-1'].out;
        transform.modifiers.namespace = { 'var-3': { variable: `$.${AGENT_ID}.tools.modelDefinedParameter`, functions: [] } };

        const tools = await AIAgent.getAllToolsDefinition(context);
        await AIAgent.callTools(context, [{
            id: 'call-1',
            function: { name: TOOL_NAME, arguments: '{"text":"password policy","namespace":"hr"}' }
        }]);

        assert.deepStrictEqual(Object.keys(tools[0].function.parameters.properties), ['text', 'namespace']);
        assert.strictEqual(componentCalls[1].body.messages.in.namespace, 'hr');
    });
});
