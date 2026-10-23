'use strict';
/* eslint-disable no-underscore-dangle */
// The `_*` fields are tool.js's own execution metadata; the tests assert on them on purpose.

const assert = require('assert');
const sinon = require('sinon');

const AIAgent = require('../../AIAgent/AIAgent');
const componentTool = require('../../tool');

const AGENT = 'aaaaaaaa-0000-4000-8000-000000000001';
const TOOL_START = 'bbbbbbbb-0000-4000-8000-000000000002';
const MOCK_VALUE = 'cccccccc-0000-4000-8000-000000000003';
const MOCK_VALUE_TYPE = 'appmixer.utils.controls.MockValue';

const MOCK_VALUE_MANIFEST = {
    name: MOCK_VALUE_TYPE,
    label: 'Mock Value',
    description: 'Outputs the value it was given.',
    inPorts: [{
        name: 'in',
        schema: { type: 'object', properties: { value: { type: 'string' } } },
        inspector: { inputs: { value: { type: 'text', label: 'Value' } } }
    }],
    outPorts: [{ name: 'out' }]
};

/**
 * A flow with the agent, a ToolStart "Weather" (parameter city) and a plain
 * MockValue "Secret code" on the agent's 'tool' port.
 */
function flowDescriptor({ withToolStart = true, withPlain = true } = {}) {

    const flow = { [AGENT]: { type: 'appmixer.ai.mistral.AIAgent', source: {} } };
    if (withToolStart) {
        flow[TOOL_START] = {
            type: 'appmixer.ai.agenttools.ToolStart',
            label: 'Weather',
            source: { in: { [AGENT]: ['tool'] } },
            config: { properties: {
                description: 'Returns the current weather for one city.',
                parameters: { ADD: [{ name: 'city', type: 'string', description: 'Name of the city.' }] }
            } }
        };
    }
    if (withPlain) {
        flow[MOCK_VALUE] = {
            type: MOCK_VALUE_TYPE,
            label: 'Secret code',
            source: { in: { [AGENT]: ['tool'] } },
            config: { transform: { in: { [AGENT]: { tool: {
                type: 'json2new', modifiers: { value: {} }, lambda: { value: 'MISTRAL-KIWI-7731' }
            } } } } }
        };
    }
    return flow;
}

function createContext({ flow, flowState = {}, callAppmixer, httpRequest } = {}) {

    const state = {};
    const context = {
        componentId: AGENT,
        flowId: 'flow-1',
        flowDescriptor: flow || flowDescriptor(),
        auth: { apiKey: 'KEY' },
        config: { TOOLS_OUTPUT_POLL_INTERVAL: 1, TOOLS_OUTPUT_POLL_TIMEOUT: 200 },
        properties: {},
        messages: { in: { correlationId: 'corr-1', content: { prompt: 'What is the weather in Prague?', threadId: 't1' } } },
        CancelError: class CancelError extends Error {},
        log: sinon.stub().resolves(),
        sendJson: sinon.stub().resolves(),
        pubSubPublish: sinon.stub().resolves(),
        stateGet: async (key) => state[key],
        stateSet: async (key, value) => { state[key] = value; },
        stateUnset: async (key) => { delete state[key]; },
        flow: {
            stateGet: async (key) => flowState[key],
            stateSet: async (key, value) => { flowState[key] = value; },
            stateUnset: async (key) => { delete flowState[key]; }
        },
        callAppmixer: callAppmixer || sinon.stub().callsFake(async ({ endPoint }) => {
            if (endPoint.startsWith('/components?selector=')) {
                return [MOCK_VALUE_MANIFEST];
            }
            return { message: 'Enqueued.' };
        }),
        httpRequest: httpRequest || sinon.stub().resolves({ data: {} })
    };
    return context;
}

describe('ai.mistral AIAgent - tools on the tool port', () => {

    afterEach(() => sinon.restore());

    it('builds a ToolStart definition from its description and parameters', async () => {

        const context = createContext();
        const defs = await AIAgent.collectTools(context);
        const toolStart = defs.find((def) => def.function._isToolStart);

        assert(toolStart, 'ToolStart on the tool port is a tool');
        assert.strictEqual(toolStart.function._componentId, TOOL_START);
        assert.strictEqual(toolStart.function.description, 'Returns the current weather for one city.');
        assert.deepStrictEqual(toolStart.function.parameters, {
            type: 'object',
            properties: { city: { type: 'string', description: 'Name of the city.' } },
            required: ['city']
        });
        assert(toolStart.function.name.endsWith('_Weather'));
    });

    it('keeps a plain component next to the ToolStart as a tool of its own', async () => {

        const context = createContext();
        const defs = await AIAgent.collectTools(context);
        const plain = defs.find((def) => def.function._componentId === MOCK_VALUE);

        assert(plain, 'plain component is a tool too');
        assert(!plain.function._isToolStart);
        assert.deepStrictEqual(plain.function._userStaticValues, { value: 'MISTRAL-KIWI-7731' });
    });

    it('sends every function with parameters - Mistral rejects one without', async () => {

        const context = createContext();
        const defs = await AIAgent.collectTools(context);
        for (const def of defs) {
            const fn = AIAgent.toFunctionDef(def).function;
            assert.strictEqual(fn.parameters.type, 'object');
            assert(fn.parameters.properties, `${fn.name} has parameters.properties`);
            assert(!Object.keys(fn).some((key) => key.startsWith('_')), 'no internal fields leave the agent');
        }
    });

    it('calls a ToolStart through its webhook route and never through sendJson', async () => {

        const flowState = {};
        const callAppmixer = sinon.stub().callsFake(async ({ endPoint, body }) => {
            if (endPoint.startsWith('/components?selector=')) {
                return [MOCK_VALUE_MANIFEST];
            }
            // What the ToolStart -> ... -> ToolOutput chain does on the instance.
            const [call] = body.toolCalls;
            flowState[call.id] = { output: `Sunny in ${call.args.city}.` };
            return { message: 'Enqueued.' };
        });
        const context = createContext({ flowState, callAppmixer });
        const defs = await AIAgent.collectTools(context);
        const toolStart = defs.find((def) => def.function._isToolStart);

        const output = await componentTool.executeComponentTool(context, toolStart, { city: 'Prague' }, { correlationId: 'corr-1' });

        assert.strictEqual(output, 'Sunny in Prague.');
        const trigger = callAppmixer.getCalls().find((call) => call.args[0].endPoint.startsWith('/flows/'));
        assert(trigger, 'the ToolStart was triggered through the engine route');
        assert.strictEqual(trigger.args[0].method, 'POST');
        assert(trigger.args[0].endPoint.startsWith(`/flows/flow-1/components/${TOOL_START}?`), trigger.args[0].endPoint);
        assert(trigger.args[0].endPoint.includes('enqueueOnly=true'));
        assert(trigger.args[0].endPoint.includes('correlationId=corr-1'), 'the tool run stays under the agent correlation');
        assert.strictEqual(trigger.args[0].body.toolCalls[0].componentId, TOOL_START);
        assert.deepStrictEqual(trigger.args[0].body.toolCalls[0].args, { city: 'Prague' });
        assert.strictEqual(context.sendJson.callCount, 0, 'sendJson would reach every tool on the port');
        assert.deepStrictEqual(flowState, {}, 'the output is removed from the flow state once read');
    });

    it('returns an error text instead of throwing when the ToolStart chain produces no ToolOutput', async () => {

        const context = createContext();
        const defs = await AIAgent.collectTools(context);
        const toolStart = defs.find((def) => def.function._isToolStart);

        const output = await componentTool.executeComponentTool(context, toolStart, { city: 'Brno' }, { correlationId: 'corr-1' });

        assert.match(output, /did not return an output within 200ms/);
        assert.match(output, /Tool Output/);
    });

    it('returns the answer of the final turn and feeds every tool call back to the model', async () => {

        const flowState = {};
        const callAppmixer = sinon.stub().callsFake(async ({ endPoint, body }) => {
            if (endPoint.startsWith('/components?selector=')) {
                return [MOCK_VALUE_MANIFEST];
            }
            if (endPoint.startsWith('/flows/')) {
                const [call] = body.toolCalls;
                flowState[call.id] = { output: `Sunny in ${call.args.city}.` };
                return { message: 'Enqueued.' };
            }
            // Static call of the plain MockValue tool.
            return { outvalue: body.messages.in.value };
        });
        const requests = [];
        const httpRequest = sinon.stub().callsFake(async (options) => {
            requests.push(options.data);
            if (requests.length === 1) {
                const tools = options.data.tools;
                const weather = tools.find((tool) => tool.function.name.endsWith('_Weather'));
                const secret = tools.find((tool) => !tool.function.name.endsWith('_Weather'));
                return { data: { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }, choices: [{
                    finish_reason: 'tool_calls',
                    message: { role: 'assistant', content: '', tool_calls: [
                        { id: 'c1', type: 'function', function: { name: weather.function.name, arguments: '{"city":"Prague"}' } },
                        { id: 'c2', type: 'function', function: { name: secret.function.name, arguments: '{}' } }
                    ] }
                }] } };
            }
            return { data: { usage: { prompt_tokens: 20, completion_tokens: 5, total_tokens: 25 }, choices: [{
                finish_reason: 'stop', message: { role: 'assistant', content: 'Sunny in Prague. Code MISTRAL-KIWI-7731.' }
            }] } };
        });
        const context = createContext({ flowState, callAppmixer, httpRequest });

        await AIAgent.start(context);
        await AIAgent.receive(context);

        const out = context.sendJson.getCalls().find((call) => call.args[1] === 'out');
        assert(out, 'answer sent to out');
        assert.strictEqual(out.args[0].answer, 'Sunny in Prague. Code MISTRAL-KIWI-7731.');
        assert.deepStrictEqual(out.args[0].usage, { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 });
        assert.strictEqual(context.sendJson.callCount, 1, 'nothing but the answer leaves through sendJson');

        const second = requests[1];
        const toolMessages = second.messages.filter((message) => message.role === 'tool');
        assert.deepStrictEqual(toolMessages.map((message) => message.tool_call_id).sort(), ['c1', 'c2']);
        assert(toolMessages.find((message) => message.content === 'Sunny in Prague.'));
        assert(toolMessages.find((message) => message.content.includes('MISTRAL-KIWI-7731')));
        assert.strictEqual(second.messages[0].role, 'system', 'instructions lead every request');
    });

    it('reads the text out of a reasoning model answer (content as chunks)', () => {

        assert.strictEqual(AIAgent.toText([{ type: 'thinking', thinking: 'hm' }, { type: 'text', text: 'Pong' }]), 'Pong');
        assert.strictEqual(AIAgent.toText('Pong'), 'Pong');
        assert.strictEqual(AIAgent.toText(null), '');
    });
});
