'use strict';

const assert = require('assert');
const sinon = require('sinon');
const { createMockContext } = require('../../../../../../test/utils');

const Condition = require('../../Condition/Condition');

function run(expression) {

    const context = createMockContext({
        messages: { in: { content: { expression: { AND: [{ OR: [expression] }] } } } }
    });
    Condition.receive(context);
    assert.strictEqual(context.sendJson.callCount, 1);
    return context.sendJson.firstCall.args[1];
}

describe('Condition Component', () => {

    afterEach(() => {
        sinon.restore();
    });

    describe('missing input', () => {

        [undefined, null].forEach(input => {

            it(`contains routes ${input} input to false`, () => {
                assert.strictEqual(run({ input, operator: 'contains', value: 'foo' }), 'false');
            });

            it(`contains routes ${input} input to false even when value is 'null'`, () => {
                assert.strictEqual(run({ input, operator: 'contains', value: 'null' }), 'false');
            });

            it(`regex routes ${input} input to false`, () => {
                assert.strictEqual(run({ input, operator: 'regex', regex: 'n' }), 'false');
            });

            ['=', '!=', '>', '>=', '<', '<=', '%', 'empty', 'notEmpty', 'range'].forEach(operator => {
                it(`${operator} does not throw on ${input} input`, () => {
                    const port = run({
                        input,
                        operator,
                        value: '1',
                        divisor: 2,
                        rangeMin: '1',
                        rangeMax: '5'
                    });
                    assert.ok(['true', 'false'].includes(port));
                });
            });
        });

        it('empty routes undefined input to true', () => {
            assert.strictEqual(run({ input: undefined, operator: 'empty' }), 'true');
        });

        it('contains routes to false when value is undefined', () => {
            assert.strictEqual(run({ input: 'foo', operator: 'contains', value: undefined }), 'false');
        });
    });

    describe('contains', () => {

        it('matches case-insensitively', () => {
            assert.strictEqual(run({ input: 'Extra Bed requested', operator: 'contains', value: 'extra bed' }), 'true');
        });

        it('does not match a missing substring', () => {
            assert.strictEqual(run({ input: 'Late arrival', operator: 'contains', value: 'bed' }), 'false');
        });

        it('matches inside a non-string input', () => {
            assert.strictEqual(run({ input: { notes: 'Crib' }, operator: 'contains', value: 'crib' }), 'true');
        });
    });

    describe('regex', () => {

        it('matches a string input', () => {
            assert.strictEqual(run({ input: 'ABC-123', operator: 'regex', regex: '^[A-Z]+-\\d+$' }), 'true');
        });

        it('throws CancelError on an invalid pattern', () => {
            assert.throws(
                () => run({ input: 'abc', operator: 'regex', regex: '(' }),
                err => err.name === 'CancelError' && err.message.includes('Invalid regular expression')
            );
        });
    });

    describe('operator', () => {

        function runExpression(expression) {

            const context = createMockContext({ messages: { in: { content: { expression } } } });
            Condition.receive(context);
            return context;
        }

        it('throws CancelError naming the clause without an operator', () => {
            assert.throws(
                () => runExpression({
                    AND: [{ OR: [{ input: 'a', operator: '=', value: 'a' }, { input: 'VIP', value: 'VIP' }] }]
                }),
                err => err.name === 'CancelError' && err.message.startsWith('AND[0].OR[1]: missing operator')
            );
        });

        it('throws CancelError naming the clause with an unsupported operator', () => {
            assert.throws(
                () => runExpression({
                    AND: [
                        { OR: [{ input: 'a', operator: '=', value: 'a' }] },
                        { OR: [{ input: 'a', operator: 'equals', value: 'a' }] }
                    ]
                }),
                err => err.name === 'CancelError' && err.message.startsWith('AND[1].OR[0]: unsupported operator \'equals\'')
            );
        });

        it('reports a broken clause even when an earlier AND group already failed', () => {
            assert.throws(
                () => runExpression({
                    AND: [
                        { OR: [{ input: 'a', operator: '=', value: 'b' }] },
                        { OR: [{ input: 'a', operator: '' }] }
                    ]
                }),
                err => err.name === 'CancelError' && err.message.startsWith('AND[1].OR[0]: missing operator')
            );
        });

        it('does not send anything when a clause is invalid', () => {
            const context = createMockContext({
                messages: { in: { content: { expression: { AND: [{ OR: [{ input: 'a' }] }] } } } }
            });
            assert.throws(() => Condition.receive(context));
            assert.strictEqual(context.sendJson.callCount, 0);
        });
    });

    describe('component.json schema', () => {

        const component = require('../../Condition/component.json');
        const clause = component.inPorts[0].schema.properties.expression.properties.AND.items.properties.OR.items;

        it('requires an operator on every clause', () => {
            assert.deepStrictEqual(clause.required, ['operator']);
        });

        it('marks the operator as required in the inspector, with a guard for the AND groups', () => {
            // 'required' makes the designer highlight the Operator select of a clause that has none.
            // The engine's flow validator walks only the first level of an expression, so without the 'when' it
            // would take every { OR: [...] } group for a row with no operator and report a valid Condition.
            // The engine compares strictly, so the 'when' is never met there (the schema enforces the operator).
            // The designer compares loosely, so the 'when' is met in every clause and the select stays visible.
            const operator = component.inPorts[0].inspector.inputs.expression.fields.operator;
            assert.strictEqual(operator.required, true);
            assert.deepStrictEqual(operator.when, { eq: { './OR': null } });
        });

        it('allows exactly the operators offered in the inspector', () => {
            const options = component.inPorts[0].inspector.inputs.expression.fields.operator.options.map(o => o.value);
            assert.deepStrictEqual(clause.properties.operator.enum, options);
        });

        it('allows exactly the operators the component evaluates', () => {
            clause.properties.operator.enum.forEach(operator => {
                const port = run({ input: '1', operator, value: '1', divisor: 1, rangeMin: '0', rangeMax: '2', regex: '1' });
                assert.ok(['true', 'false'].includes(port), operator);
            });
        });
    });
});
