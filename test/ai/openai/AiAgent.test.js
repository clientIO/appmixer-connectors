const assert = require('assert');
const { getToolsDefinition } = require('../../../src/appmixer/ai/openai/AIAgent/AIAgent');

describe('ai.openai AIAgent', () => {

    it('should handle parameters.ADD with empty object', () => {
        const tools = {
            comp1: {
                config: {
                    properties: {
                        description: 'desc',
                        parameters: {
                            ADD: [
                                { name: 'foo', type: 'string', description: 'desc' },
                                {} // empty object
                            ]
                        }
                    }
                },
                type: 'appmixer.ai.openai.AIAgent'
            }
        };
        // Should not throw, should skip empty param
        const result = getToolsDefinition(tools);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].function.name, 'comp1_AIAgent');
        assert.strictEqual(result[0].function.description, 'desc');
        assert.deepStrictEqual(result[0].function.parameters.properties.foo, { type: 'string', description: 'desc' });
        // Should not include empty property
        assert.strictEqual(Object.keys(result[0].function.parameters.properties).length, 1);
    });
});
