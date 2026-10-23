'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { createMockContext } = require('../../../../../../test/utils');

const Switch5 = require('../../Switch5/Switch5');

function runContent(content) {

    const context = createMockContext({ messages: { in: { content } } });
    Switch5.receive(context);
    assert.strictEqual(context.sendJson.callCount, 1);
    return context.sendJson.firstCall.args[1];
}

function run(expression) {

    return runContent({ expression1: { AND: [{ OR: [expression] }] } });
}

describe('Switch5 Component', () => {

    afterEach(() => {
        sinon.restore();
    });

    describe('missing input', () => {

        [undefined, null].forEach(input => {

            it(`contains routes ${input} input to else`, () => {
                assert.strictEqual(run({ input, operator: 'contains', value: 'abc' }), 'else');
            });

            it(`contains routes ${input} input to else even when value is 'null'`, () => {
                assert.strictEqual(run({ input, operator: 'contains', value: 'null' }), 'else');
            });

            it(`regex routes ${input} input to else`, () => {
                assert.strictEqual(run({ input, operator: 'regex', regex: 'undefined|null' }), 'else');
            });

            ['=', '!=', '>', '>=', '<', '<=', '%', 'empty', 'notEmpty', 'contains', 'range', 'regex'].forEach(operator => {
                it(`${operator} does not throw on ${input} input`, () => {
                    const port = run({
                        input,
                        operator,
                        value: '1',
                        divisor: 2,
                        rangeMin: '1',
                        rangeMax: '5',
                        regex: 'n'
                    });
                    assert.ok(['out1', 'else'].includes(port));
                });
            });
        });

        it('empty routes undefined input to out1', () => {
            assert.strictEqual(run({ input: undefined, operator: 'empty' }), 'out1');
        });

        it('contains routes to else when value is undefined', () => {
            assert.strictEqual(run({ input: 'foo', operator: 'contains', value: undefined }), 'else');
        });

        it('falls through to the next matching output when an earlier clause has a missing input', () => {
            const port = runContent({
                expression1: { AND: [{ OR: [{ input: undefined, operator: 'contains', value: 'abc' }] }] },
                expression2: { AND: [{ OR: [{ input: 'xyz abc', operator: 'contains', value: 'ABC' }] }] }
            });
            assert.strictEqual(port, 'out2');
        });
    });

    describe('contains', () => {

        it('matches case-insensitively', () => {
            assert.strictEqual(run({ input: 'Extra Bed requested', operator: 'contains', value: 'extra bed' }), 'out1');
        });

        it('does not match a missing substring', () => {
            assert.strictEqual(run({ input: 'Late arrival', operator: 'contains', value: 'bed' }), 'else');
        });

        it('matches inside a non-string input', () => {
            assert.strictEqual(run({ input: { notes: 'Crib' }, operator: 'contains', value: 'crib' }), 'out1');
        });
    });

    describe('regex', () => {

        it('matches a string input', () => {
            assert.strictEqual(run({ input: 'ABC-123', operator: 'regex', regex: '^[A-Z]+-\\d+$' }), 'out1');
        });

        it('does not match a non-matching input', () => {
            assert.strictEqual(run({ input: 'abc', operator: 'regex', regex: '^\\d+$' }), 'else');
        });

        it('throws CancelError on an invalid pattern', () => {
            assert.throws(
                () => run({ input: 'abc', operator: 'regex', regex: '(' }),
                err => err.name === 'CancelError' && err.message.includes('Invalid regular expression')
            );
        });
    });

    it('routes to else when no expression is defined', () => {
        assert.strictEqual(runContent({}), 'else');
    });
});
