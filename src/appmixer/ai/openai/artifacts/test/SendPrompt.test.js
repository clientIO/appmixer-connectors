const assert = require('assert');
const testUtils = require('../../../../../../test/utils.js');

describe('ai/openai SendPrompt', () => {
    it('sends prompt and returns answer (happy path)', async () => {
        const sent = [];

        // stub the local lib.request used by the SendPrompt module
        const libPath = require.resolve('../../lib');
        const lib = require(libPath);
        lib.request = async (context, method, endpoint, data) => {
            // validate inputs
            assert.strictEqual(method, 'post');
            assert.strictEqual(endpoint, '/chat/completions');
            assert.strictEqual(data.messages[1].content, 'Hello OpenAI');
            return { data: { choices: [{ message: { content: 'Hello from OpenAI' } }] } };
        };

        // require the component after stubbing the lib so it uses the stubbed function
        const SendPrompt = require('../../SendPrompt/SendPrompt');

        const context = testUtils.createMockContext({
            messages: {
                in: {
                    content: {
                        prompt: 'Hello OpenAI',
                        model: 'gpt-4o'
                    }
                }
            },
            auth: { apiKey: 'test-api-key' },
            // override sendJson to capture outgoing messages
            sendJson: (payload, port) => {
                sent.push({ payload, port });
                return Promise.resolve();
            }
        });

        await SendPrompt.receive(context);
        assert.strictEqual(sent.length, 1);
        assert.deepStrictEqual(sent[0].payload, { answer: 'Hello from OpenAI', prompt: 'Hello OpenAI' });
        assert.strictEqual(sent[0].port, 'out');
    });

    it('coerces sampling inputs to numbers and drops the ones that are not set', async () => {
        const libPath = require.resolve('../../lib');
        const lib = require(libPath);
        let sentData;
        lib.request = async (context, method, endpoint, data) => {
            sentData = data;
            return { data: { choices: [{ message: { content: 'ok' } }] } };
        };
        const SendPrompt = require('../../SendPrompt/SendPrompt');

        const context = testUtils.createMockContext({
            messages: {
                in: {
                    content: {
                        prompt: 'Hello',
                        instructions: 'Answer tersely.',
                        temperature: '0.2',   // bound to a flow variable -> string
                        maxTokens: '50',
                        topP: '',              // left empty in the inspector
                        frequencyPenalty: 'abc',
                        presencePenalty: 0
                    }
                }
            },
            auth: { apiKey: 'test-api-key' },
            sendJson: async () => {}
        });

        await SendPrompt.receive(context);
        assert.strictEqual(sentData.messages[0].content, 'Answer tersely.');
        assert.strictEqual(sentData.temperature, 0.2);
        assert.strictEqual(sentData.max_tokens, 50);
        assert.strictEqual(sentData.presence_penalty, 0);
        assert.strictEqual('top_p' in sentData, false);
        assert.strictEqual('frequency_penalty' in sentData, false);
    });

    it('throws when prompt is missing', async () => {
        const CancelError = class CancelError extends Error {};
        const SendPrompt = require('../../SendPrompt/SendPrompt');
        try {
            await SendPrompt.receive({ messages: { in: { content: {} } }, sendJson: async () => {}, CancelError });
            assert.fail('expected to throw for missing prompt');
        } catch (err) {
            assert.strictEqual(err.message, 'Prompt is required');
        }
    });
});
