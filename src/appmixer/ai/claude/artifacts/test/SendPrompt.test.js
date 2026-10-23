const assert = require('assert');
const SendPrompt = require('../../SendPrompt/SendPrompt');

describe('ai/claude SendPrompt', () => {
    it('sends prompt and returns answer (happy path)', async () => {
        const sent = [];

        const context = {
            messages: {
                in: {
                    content: {
                        prompt: 'Hello there',
                        system: 'You are helpful',
                        model: 'claude-1',
                        max_tokens: 50
                    }
                }
            },
            auth: { apiKey: 'test-api-key' },
            httpRequest: async (opts) => {
                // basic verification of request shape
                assert.strictEqual(opts.method, 'POST');
                assert.strictEqual(opts.url, 'https://api.anthropic.com/v1/messages');
                assert.strictEqual(opts.headers['x-api-key'], 'test-api-key');
                // simulate API response shape expected by the code
                return {
                    data: {
                        model: 'claude-1-20250101',
                        stop_reason: 'end_turn',
                        content: [{ text: 'Hi — I am Claude' }],
                        usage: { input_tokens: 12, output_tokens: 6, cache_read_input_tokens: 0 }
                    }
                };
            },
            sendJson: (payload, port) => {
                sent.push({ payload, port });
                return Promise.resolve();
            },
            CancelError: class CancelError extends Error {}
        };

        await SendPrompt.receive(context);

        assert.strictEqual(sent.length, 1);
        assert.deepStrictEqual(sent[0].payload, {
            answer: 'Hi — I am Claude',
            prompt: 'Hello there',
            usage: { input_tokens: 12, output_tokens: 6, cache_read_input_tokens: 0 },
            stop_reason: 'end_turn',
            model: 'claude-1-20250101'
        });
        assert.strictEqual(sent[0].port, 'out');
    });

    it('throws when required fields are missing', async () => {
        const CancelError = class CancelError extends Error {};

        // missing prompt
        try {
            await SendPrompt.receive({
                messages: { in: { content: { } } },
                auth: { apiKey: 'k' },
                httpRequest: async () => { throw new Error('should not be called'); },
                sendJson: async () => {},
                CancelError
            });
            assert.fail('expected to throw for missing prompt');
        } catch (err) {
            assert.strictEqual(err.message, 'Prompt is required');
        }

        // missing model
        try {
            await SendPrompt.receive({
                messages: { in: { content: { prompt: 'p' } } },
                auth: { apiKey: 'k' },
                httpRequest: async () => { throw new Error('should not be called'); },
                sendJson: async () => {},
                CancelError
            });
            assert.fail('expected to throw for missing model');
        } catch (err) {
            assert.strictEqual(err.message, 'Model is required');
        }

        // missing max_tokens
        try {
            await SendPrompt.receive({
                messages: { in: { content: { prompt: 'p', model: 'm' } } },
                auth: { apiKey: 'k' },
                httpRequest: async () => { throw new Error('should not be called'); },
                sendJson: async () => {},
                CancelError
            });
            assert.fail('expected to throw for missing max_tokens');
        } catch (err) {
            assert.strictEqual(err.message, 'Max Tokens is required');
        }
    });
});
