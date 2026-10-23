'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { createMockContext } = require('../../../../../../test/utils');

const AIAgent = require('../../AIAgent/AIAgent');

const AGENT_ID = 'agent-1';
const TOOL_NAME = 'rows-1_Employee_contacts';

/** A flow with one Google Sheets GetRows on the agent's 'tools' port, its filter filled by the model. */
function toolPortContext(prompt = 'Who is the CEO?') {

    const context = createMockContext({
        componentId: AGENT_ID,
        flowId: 'flow-1',
        messages: { in: { correlationId: 'corr-1', content: { prompt, model: 'claude-haiku-4-5' } } },
        auth: { apiKey: 'key' },
        flowDescriptor: {
            [AGENT_ID]: { type: 'appmixer.ai.claude.AIAgent' },
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
                                            'var-1': { variable: `$.${AGENT_ID}.tools.modelDefinedParameter`, functions: [] }
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
    context.log = sinon.stub().resolves();
    const flowState = {};
    context.flow = {
        stateGet: async (key) => flowState[key],
        stateSet: async (key, value) => { flowState[key] = value; },
        stateUnset: async (key) => { delete flowState[key]; }
    };
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
    return context;
}

/** Messages API answers, one per call, recorded with the requests. */
function anthropic(context, responses) {

    const requests = [];
    context.httpRequest = sinon.stub().callsFake(async (opts) => {
        requests.push(JSON.parse(JSON.stringify(opts.data)));
        const data = responses[requests.length - 1];
        if (!data) throw new Error('unexpected Messages API call ' + requests.length);
        return { data };
    });
    return requests;
}

const usage = { input_tokens: 10, output_tokens: 5 };

describe('ai/claude AIAgent - components on the tools port', () => {

    it('should send a component on the tools port as an Anthropic tool', async () => {

        const context = toolPortContext();
        const requests = anthropic(context, [
            { content: [{ type: 'text', text: 'Hi' }], stop_reason: 'end_turn', model: 'claude-haiku-4-5-x', usage }
        ]);

        await AIAgent.start(context);
        await AIAgent.receive(context);

        assert.deepStrictEqual(requests[0].tools, [{
            name: TOOL_NAME,
            description: 'Employee contacts - Get rows from a sheet.',
            input_schema: {
                type: 'object',
                properties: { filter: { type: 'string', description: 'Filter — Rows to return.' } }
            }
        }]);
    });

    it('should send max_tokens from the Max Tokens input, 8192 by default', async () => {

        const context = toolPortContext();
        const requests = anthropic(context, [
            { content: [{ type: 'text', text: 'a' }], stop_reason: 'end_turn', usage },
            { content: [{ type: 'text', text: 'b' }], stop_reason: 'end_turn', usage }
        ]);

        await AIAgent.start(context);
        await AIAgent.receive(context);
        context.messages.in.content.maxTokens = 16000;
        await AIAgent.receive(context);

        assert.deepStrictEqual(requests.map(r => r.max_tokens), [8192, 16000]);
    });

    it('should not ask a Claude 3 model for more than its 4096 tokens by default', async () => {

        const context = toolPortContext();
        context.messages.in.content.model = 'claude-3-haiku-20240307';
        const requests = anthropic(context, [{ content: [{ type: 'text', text: 'a' }], stop_reason: 'end_turn', usage }]);

        await AIAgent.start(context);
        await AIAgent.receive(context);

        assert.strictEqual(requests[0].max_tokens, 4096);
    });

    it('should collect the tools itself when the message comes before start() stored them', async () => {

        const context = toolPortContext();
        const requests = anthropic(context, [
            { content: [{ type: 'text', text: 'Hi' }], stop_reason: 'end_turn', usage }
        ]);

        // No start(): OnStart can deliver the message while start() still fetches the manifests
        await AIAgent.receive(context);

        assert.deepStrictEqual(requests[0].tools.map(t => t.name), [TOOL_NAME]);
    });

    it('should call the component directly and return its output as the tool_result', async () => {

        const context = toolPortContext();
        const requests = anthropic(context, [
            {
                content: [
                    { type: 'text', text: 'Let me look.' },
                    { type: 'tool_use', id: 'tu-1', name: TOOL_NAME, input: { filter: 'CEO', sheetId: 'other' } }
                ],
                stop_reason: 'tool_use',
                usage
            },
            { content: [{ type: 'text', text: 'Jane Doe is the CEO.' }], stop_reason: 'end_turn', model: 'm', usage }
        ]);

        await AIAgent.start(context);
        await AIAgent.receive(context);

        const call = context.callAppmixer.lastCall.args[0];
        assert.strictEqual(call.endPoint, '/component/appmixer/google/spreadsheets/GetRows');
        // The model fills only the model defined field; the static value wins over its sheetId.
        assert.deepStrictEqual(call.body, { componentId: 'rows-1', messages: { in: { filter: 'CEO', sheetId: 'sheet-1' } } });

        const [assistant, results] = requests[1].messages.slice(-2);
        assert.strictEqual(assistant.role, 'assistant');
        assert.deepStrictEqual(assistant.content.map(c => c.type), ['text', 'tool_use']);
        assert.deepStrictEqual(results, {
            role: 'user',
            content: [{ type: 'tool_result', tool_use_id: 'tu-1', content: JSON.stringify({ rows: [['Jane Doe', 'CEO']] }, null, 2) }]
        });

        const out = context.sendJson.getCalls().find(c => c.args[1] === 'out').args[0];
        assert.strictEqual(out.answer, 'Jane Doe is the CEO.');
        assert.deepStrictEqual(out.usage, { input_tokens: 20, output_tokens: 10 });
        assert(!context.sendJson.getCalls().some(c => c.args[1] === 'tools'), 'nothing should go to the tools port');
    });

    it('should answer every tool_use block of a turn in one user message', async () => {

        const context = toolPortContext();
        const requests = anthropic(context, [
            {
                content: [
                    { type: 'tool_use', id: 'tu-1', name: TOOL_NAME, input: { filter: 'CEO' } },
                    { type: 'tool_use', id: 'tu-2', name: TOOL_NAME, input: { filter: 'CTO' } }
                ],
                stop_reason: 'tool_use',
                usage
            },
            { content: [{ type: 'text', text: 'Done.' }], stop_reason: 'end_turn', usage }
        ]);

        await AIAgent.start(context);
        await AIAgent.receive(context);

        const results = requests[1].messages.at(-1);
        assert.strictEqual(results.role, 'user');
        assert.deepStrictEqual(results.content.map(r => r.tool_use_id), ['tu-1', 'tu-2']);
        assert.deepStrictEqual(context.callAppmixer.getCalls().filter(c => c.args[0].endPoint.startsWith('/component/'))
            .map(c => c.args[0].body.messages.in.filter), ['CEO', 'CTO']);
    });

    it('should hand a tool error back to the model instead of failing', async () => {

        const context = toolPortContext();
        const requests = anthropic(context, [
            { content: [{ type: 'tool_use', id: 'tu-1', name: TOOL_NAME, input: { filter: 'CEO' } }], stop_reason: 'tool_use', usage },
            { content: [{ type: 'text', text: 'The sheet is not available.' }], stop_reason: 'end_turn', usage }
        ]);

        await AIAgent.start(context);
        context.callAppmixer = sinon.stub().rejects(new Error('Sheet not found'));
        await AIAgent.receive(context);

        assert.match(requests[1].messages.at(-1).content[0].content, /Error calling tool .*Sheet not found/);
    });

    it('should stop when the model keeps asking for tools', async () => {

        const context = toolPortContext();
        const loop = { content: [{ type: 'tool_use', id: 'tu', name: TOOL_NAME, input: {} }], stop_reason: 'tool_use', usage };
        anthropic(context, Array(25).fill(loop));

        await AIAgent.start(context);
        await assert.rejects(AIAgent.receive(context), /still asked for tools after 20 turns/);
    });

    it('should not start with a tool that cannot be loaded', async () => {

        const context = toolPortContext();
        context.callAppmixer = sinon.stub().rejects(new Error('503'));

        await assert.rejects(AIAgent.start(context), /Employee contacts .* could not be loaded: 503/);
    });

    it('should call a ToolStart next to a component through its webhook route, not through the port', async () => {

        const context = toolPortContext();
        context.flowDescriptor.ts1 = {
            type: 'appmixer.ai.agenttools.ToolStart',
            label: 'Weather',
            source: { in: { [AGENT_ID]: ['tools'] } },
            config: { properties: { description: 'Weather in a city', parameters: { ADD: [{ name: 'city', type: 'string' }] } } }
        };
        const requests = anthropic(context, [
            { content: [{ type: 'tool_use', id: 'tu-1', name: 'ts1_Weather', input: { city: 'Prague' } }], stop_reason: 'tool_use', usage },
            { content: [{ type: 'text', text: 'Sunny.' }], stop_reason: 'end_turn', usage }
        ]);
        const getRows = context.callAppmixer;
        context.callAppmixer = sinon.stub().callsFake(async (options) => {
            if (!options.endPoint.startsWith('/flows/')) return getRows(options);
            // The ToolStart -> ... -> ToolOutput chain on the instance.
            await context.flow.stateSet(options.body.toolCalls[0].id, { output: '22 °C, sunny' });
            return { message: 'Enqueued.' };
        });

        await AIAgent.start(context);
        await AIAgent.receive(context);

        assert.deepStrictEqual(requests[0].tools.map(t => t.name).sort(), [TOOL_NAME, 'ts1_Weather']);
        const trigger = context.callAppmixer.getCalls().find(c => c.args[0].endPoint.startsWith('/flows/')).args[0];
        assert.strictEqual(trigger.endPoint, '/flows/flow-1/components/ts1?enqueueOnly=true&correlationId=corr-1');
        assert.deepStrictEqual(trigger.body, {
            toolCalls: [{ componentId: 'ts1', args: { city: 'Prague' }, id: 'tu-1:corr-1' }],
            prompt: 'Who is the CEO?'
        });
        assert(!context.sendJson.getCalls().some(c => c.args[1] === 'tools'), 'the GetRows tool would run too');
        assert.deepStrictEqual(requests[1].messages.at(-1).content, [{ type: 'tool_result', tool_use_id: 'tu-1', content: '22 °C, sunny' }]);
    });
});

describe('ai/claude AIAgent - tools port (ToolStart)', () => {

    it('should hand the call to the ToolStart chain through the port and send its ToolOutput back', async () => {

        const context = toolPortContext();
        // ToolStarts only on the port: the flows built before components could be tools
        context.flowDescriptor = {
            [AGENT_ID]: { type: 'appmixer.ai.claude.AIAgent' },
            ts1: {
                type: 'appmixer.ai.agenttools.ToolStart',
                source: { in: { [AGENT_ID]: ['tools'] } },
                config: { properties: { description: 'Weather in a city', parameters: { ADD: [{ name: 'city', type: 'string', description: 'City' }] } } }
            }
        };
        const requests = anthropic(context, [
            { content: [{ type: 'tool_use', id: 'tu-1', name: 'ts1_tool', input: { city: 'Prague' } }], stop_reason: 'tool_use', usage },
            { content: [{ type: 'text', text: 'Sunny.' }], stop_reason: 'end_turn', usage }
        ]);
        // ToolOutput writes the output under the call id the agent sent
        context.sendJson = sinon.stub().callsFake(async (payload, port) => {
            if (port === 'tools') await context.flow.stateSet(payload.toolCalls[0].id, { output: '22 °C, sunny' });
        });

        await AIAgent.start(context);
        await AIAgent.receive(context);

        assert.deepStrictEqual(requests[0].tools, [{
            name: 'ts1_tool',
            description: 'Weather in a city',
            input_schema: { type: 'object', properties: { city: { type: 'string', description: 'City' } }, required: ['city'] }
        }]);
        const toolsCall = context.sendJson.getCalls().find(c => c.args[1] === 'tools').args[0];
        assert.deepStrictEqual(toolsCall, {
            toolCalls: [{ componentId: 'ts1', args: { city: 'Prague' }, id: 'tu-1:corr-1' }],
            prompt: 'Who is the CEO?'
        });
        assert(!context.callAppmixer.getCalls().some(c => c.args[0].endPoint.startsWith('/flows/')), 'no webhook call');
        assert.deepStrictEqual(requests[1].messages.at(-1).content, [{ type: 'tool_result', tool_use_id: 'tu-1', content: '22 °C, sunny' }]);
    });

    it('should remove a ToolOutput that came after its call had timed out', async () => {

        const context = toolPortContext();
        context.flowDescriptor = {
            [AGENT_ID]: { type: 'appmixer.ai.claude.AIAgent' },
            ts1: {
                type: 'appmixer.ai.agenttools.ToolStart',
                source: { in: { [AGENT_ID]: ['tools'] } },
                config: { properties: { description: 'Weather in a city' } }
            }
        };
        const requests = anthropic(context, [
            { content: [{ type: 'tool_use', id: 'tu-1', name: 'ts1_tool', input: {} }], stop_reason: 'tool_use', usage },
            { content: [{ type: 'text', text: 'No weather.' }], stop_reason: 'end_turn', usage },
            { content: [{ type: 'text', text: 'Hi.' }], stop_reason: 'end_turn', usage }
        ]);
        context.sendJson = sinon.stub().resolves();
        await AIAgent.start(context);

        const clock = sinon.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
        try {
            const run = AIAgent.receive(context);
            await clock.tickAsync(121 * 1000);
            await run;
        } finally {
            clock.restore();
        }
        assert.match(requests[1].messages.at(-1).content[0].content, /did not return an output within 120000ms/);

        // The ToolOutput comes late, the next message of the agent removes it.
        await context.flow.stateSet('tu-1:corr-1', { output: '22 °C' });
        await AIAgent.receive(context);
        assert.strictEqual(await context.flow.stateGet('tu-1:corr-1'), undefined);
        assert.deepStrictEqual(await context.stateGet('lateToolOutputs'), []);
    });
});
