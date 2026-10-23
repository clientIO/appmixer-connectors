/* eslint-disable camelcase */
const assert = require('assert');
const TransformTextToJSON = require('../../TransformTextToJSON/TransformTextToJSON');
const claudeLib = require('../../lib');

const createContext = (responseData, sent) => ({
    messages: {
        in: {
            content: {
                text: 'John is 25 years old.',
                jsonSchema: '{"type":"object","properties":{"name":{"type":"string"},"age":{"type":"number"}}}',
                model: 'claude-1',
                max_tokens: 100
            }
        }
    },
    properties: {},
    auth: { apiKey: 'test-api-key' },
    httpRequest: {
        post: async () => ({ data: responseData })
    },
    sendJson: (payload, port) => {
        sent.push({ payload, port });
        return Promise.resolve();
    },
    CancelError: class CancelError extends Error {}
});

describe('ai/claude TransformTextToJSON', () => {

    it('returns json, usage, stop_reason and model', async () => {
        const sent = [];
        const context = createContext({
            model: 'claude-1-20250101',
            stop_reason: 'tool_use',
            content: [{ type: 'tool_use', name: 'extract_json', input: { name: 'John', age: 25 } }],
            usage: { input_tokens: 400, output_tokens: 50 }
        }, sent);

        await TransformTextToJSON.receive(context);

        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0].port, 'out');
        assert.deepStrictEqual(sent[0].payload, {
            json: { name: 'John', age: 25 },
            usage: { input_tokens: 400, output_tokens: 50 },
            stop_reason: 'tool_use',
            model: 'claude-1-20250101'
        });
    });

    it('outputs stop_reason max_tokens instead of failing when the response is cut off', async () => {
        const sent = [];
        const context = createContext({
            model: 'claude-1-20250101',
            stop_reason: 'max_tokens',
            content: [],
            usage: { input_tokens: 400, output_tokens: 1 }
        }, sent);

        await TransformTextToJSON.receive(context);

        assert.strictEqual(sent[0].payload.stop_reason, 'max_tokens');
        assert.deepStrictEqual(sent[0].payload.json, {});
    });

    it('throws when tool_use is missing for another reason', async () => {
        const context = createContext({ stop_reason: 'end_turn', content: [] }, []);
        await assert.rejects(TransformTextToJSON.receive(context), /did not return tool_use/);
    });

    it('throws CancelError when the JSON schema is missing', async () => {
        const context = createContext({}, []);
        delete context.messages.in.content.jsonSchema;
        await assert.rejects(TransformTextToJSON.receive(context), /Output JSON Schema is required/);
    });
});

describe('ai.claude addUsage', () => {

    it('sums numeric fields across calls', () => {
        let total;
        total = claudeLib.addUsage(total, { input_tokens: 10, output_tokens: 5, service_tier: 'standard' });
        total = claudeLib.addUsage(total, { input_tokens: 20, output_tokens: 7, cache_read_input_tokens: 3, service_tier: 'standard' });
        total = claudeLib.addUsage(total, undefined);

        assert.deepStrictEqual(total, {
            input_tokens: 30,
            output_tokens: 12,
            cache_read_input_tokens: 3,
            service_tier: 'standard'
        });
    });
});
