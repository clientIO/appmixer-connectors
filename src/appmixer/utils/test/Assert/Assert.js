'use strict';
const _ = require('lodash');
const expect = require('chai').expect;

module.exports = {

    receive(context) {

        const result = {
            componentId: context.componentId,
            componentName: context.flowDescriptor[context.componentId].label,
            success: [],
            error: []
        };

        _.each(context.messages.in.content.expression['AND'], exp => {
            try {
                switch (exp.assertion) {
                    case 'notEmpty':
                        expect(exp.field).to.exist;
                        result.success.push(`${exp.field} is not empty`);
                        break;
                    case 'equal':
                        // we cannot use strict comparison, input value from a FE input is (at the moment)
                        // always a string. If you want to compare a number, it won't work. From a
                        // source component, we can get a number, but we would be comparing that always
                        // against a string
                        // another solution would be to change the expression and first let the user
                        // to select a type (number vs string) and then show text or number input.

                        // For boolean values, we convert the boolean to string: true -> 'true' and compare
                        // that against the expected value which is always a string.
                        if (typeof exp.field === 'boolean') {
                            exp.field = exp.field.toString();
                        }

                        if (exp.field != exp.expected) {
                            throw new Error(`expected ${exp.expected} to equal ${exp.field}`);
                        }
                        result.success.push(`${exp.field} equals ${exp.expected}`);
                        break;
                    case 'regex':
                        expect(exp.field).to.match(new RegExp(exp.regex));
                        result.success.push(`${exp.field} matches regex ${exp.regex}`);
                        break;
                    default:
                        throw new context.ContextCancelError(`Unsupported assertion: ${exp.assertion}`);
                }

                if (exp.type) {
                    expect(exp.field).to.be.a(exp.type);
                    result.success.push(`${exp.field} is type of ${exp.type}`);
                }
            } catch (err) {
                result.error.push(err.message);
            }
        });

        return context.sendJson(result, 'out');
    }
};
