const assert = require('assert');
const geminiLib = require('../../../src/appmixer/ai/gemini/lib');

describe('ai.gemini getFunctionDeclarations', () => {

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
                }
            }
        };
        // Should not throw, should skip empty param
        const result = geminiLib.getFunctionDeclarations(tools);
        assert.strictEqual(result.length, 1);
        assert.strictEqual(result[0].name, 'function_comp1');
        assert.strictEqual(result[0].description, 'desc');
        assert.deepStrictEqual(result[0].parameters.properties.foo, { type: 'string', description: 'desc' });
        // Should not include empty property
        assert.strictEqual(Object.keys(result[0].parameters.properties).length, 1);
    });
});
