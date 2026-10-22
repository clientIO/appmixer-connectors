const assert = require('assert');
const { addIntegrationHeader } = require('../../lib');

describe('addIntegrationHeader', () => {

    it('adds attribution only for Perplexity and preserves caller overrides', () => {

        assert.deepStrictEqual(
            addIntegrationHeader('https://api.perplexity.ai/chat/completions', {}),
            { 'X-Pplx-Integration': 'appmixer' }
        );
        assert.deepStrictEqual(
            addIntegrationHeader('https://api.perplexity.ai/chat/completions', {
                'x-pplx-integration': 'custom'
            }),
            { 'x-pplx-integration': 'custom' }
        );
        assert.deepStrictEqual(
            addIntegrationHeader('https://api.perplexity.ai.example.com/chat/completions', {}),
            {}
        );
        assert.deepStrictEqual(addIntegrationHeader('http://api.perplexity.ai/chat/completions', {}), {});
    });
});
