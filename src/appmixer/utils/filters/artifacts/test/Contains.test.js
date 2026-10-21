'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { createMockContext } = require('../../../../../../test/utils');

const Contains = require('../../Contains/Contains');

function run(sourceData, value) {

    const content = { sourceData, value };
    const context = createMockContext({ messages: { in: { content, originalContent: content } } });
    Contains.receive(context);
    assert.strictEqual(context.sendJson.callCount, 1);
    return context.sendJson.firstCall.args[1];
}

describe('utils.filters.Contains', () => {

    afterEach(() => {
        sinon.restore();
    });

    [undefined, null].forEach(sourceData => {
        it(`routes ${sourceData} data to notContains`, () => {
            assert.strictEqual(run(sourceData, 'abc'), 'notContains');
        });

        it(`routes ${sourceData} data to notContains even when value is 'null'`, () => {
            assert.strictEqual(run(sourceData, 'null'), 'notContains');
        });
    });

    it('routes to notContains when value is undefined', () => {
        assert.strictEqual(run('foo', undefined), 'notContains');
    });

    it('matches case-insensitively', () => {
        assert.strictEqual(run('Hello Appmixer', 'appmixer'), 'contains');
    });

    it('matches inside a non-string input', () => {
        assert.strictEqual(run({ notes: 'Crib' }, 'crib'), 'contains');
    });

    it('does not match a missing substring', () => {
        assert.strictEqual(run('Late arrival', 'bed'), 'notContains');
    });

    it('passes the original content through', () => {
        const content = { sourceData: 'abc', value: 'b' };
        const context = createMockContext({ messages: { in: { content, originalContent: content } } });
        Contains.receive(context);
        assert.deepStrictEqual(context.sendJson.firstCall.args[0], content);
    });
});
