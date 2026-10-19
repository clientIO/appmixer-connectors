'use strict';

const lib = require('../lib');

// Question ids become part of the output variable path (answers.<id>.choice).
const ID_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 255;
const MIN_LEVELS = 2;
const MAX_LEVELS = 10;
// A noul answer is only a probability; `result` compares it with this fixed threshold.
const NOUL_THRESHOLD = 0.5;

// Output fields per question type: [field, label, schema].
const ANSWER_FIELDS = {
    choice: [
        ['choice', 'Choice', { type: 'string' }],
        ['confidence', 'Confidence', { type: 'number' }],
        ['probabilities', 'Probabilities', { type: 'object' }]
    ],
    score: [
        ['score', 'Score', { type: 'number' }],
        ['level', 'Level', { type: 'integer' }],
        ['levelDescription', 'Level Description', { type: 'string' }],
        ['confidence', 'Confidence', { type: 'number' }],
        ['probabilities', 'Probabilities', { type: 'object' }]
    ],
    noul: [
        ['probability', 'Probability', { type: 'number' }],
        ['result', 'Result', { type: 'boolean' }]
    ]
};

// The part of the output that does not depend on the questions. The outPort is
// dynamic (one variable per answer field is added from the rows), so component.json
// declares no schema — exporting this gives the offline tooling the fixed contract.
const ITEM_SCHEMA = {
    type: 'object',
    properties: {
        answers: {
            type: 'object',
            title: 'Answers',
            example: {
                department: {
                    type: 'choice',
                    choice: 'technical',
                    confidence: 0.78,
                    probabilities: { technical: 0.85, billing: 0.15 }
                },
                is_urgent: { type: 'noul', probability: 0.97, result: true }
            }
        },
        model: { type: 'string', title: 'Model', example: 'jev-1.13.0' },
        usage: {
            type: 'object',
            title: 'Usage',
            properties: {
                inputTokens: { type: 'integer', title: 'Usage.Input Tokens', example: 392 },
                outputTokens: { type: 'integer', title: 'Usage.Output Tokens', example: 65 }
            }
        }
    }
};

const isEmpty = value => value === undefined || value === null || String(value).trim() === '';

// A textarea holds one item per line; a list mapped from a variable is taken as is.
const toLines = (value) => {

    const lines = Array.isArray(value) ? value : String(value ?? '').split(/\r?\n/);
    return lines
        .map(line => typeof line === 'string' ? line.trim() : line)
        .filter(line => !isEmpty(line));
};

// Options of a choice question: `key` or `key: description` per line -> { key: description|null }.
const parseOptions = (context, value, id) => {

    const criteria = {};
    toLines(value).forEach(line => {
        let key;
        let description;
        if (line && typeof line === 'object') {
            ({ key, description } = line);
        } else {
            const text = String(line);
            const separator = text.indexOf(':');
            key = separator === -1 ? text : text.slice(0, separator);
            description = separator === -1 ? null : text.slice(separator + 1);
        }
        key = isEmpty(key) ? '' : String(key).trim();
        if (!key) {
            throw new context.CancelError(`Question '${id}': every option needs a key.`);
        }
        if (Object.prototype.hasOwnProperty.call(criteria, key)) {
            throw new context.CancelError(`Question '${id}': duplicate option key '${key}'.`);
        }
        criteria[key] = isEmpty(description) ? null : String(description).trim();
    });

    const count = Object.keys(criteria).length;
    if (count < MIN_OPTIONS || count > MAX_OPTIONS) {
        throw new context.CancelError(
            `Question '${id}': Options must contain ${MIN_OPTIONS} to ${MAX_OPTIONS} lines, got ${count}.`
        );
    }
    return criteria;
};

// Levels of a score question: one description per line, lowest first.
const parseLevels = (context, value, id) => {

    const levels = toLines(value).map(line => String(line));
    if (levels.length < MIN_LEVELS || levels.length > MAX_LEVELS) {
        throw new context.CancelError(
            `Question '${id}': Levels must contain ${MIN_LEVELS} to ${MAX_LEVELS} lines, got ${levels.length}.`
        );
    }
    return levels;
};

/**
 * One inspector row -> the question in the API shape.
 * https://docs.typesafe.ai/primitives
 * @param {object} context
 * @param {object} row { id, type, instructions, options, levels, trueCriteria, falseCriteria }
 * @returns {{id: string, type: string, question: object}}
 */
const buildQuestion = (context, row) => {

    const id = isEmpty(row.id) ? '' : String(row.id).trim();
    if (!id) {
        throw new context.CancelError('Every question needs a Question ID.');
    }
    if (!ID_PATTERN.test(id)) {
        throw new context.CancelError(
            `Question ID '${id}' may only contain letters, digits and underscores and must not start with a digit.`
        );
    }

    const type = isEmpty(row.type) ? 'choice' : String(row.type).trim();
    if (!ANSWER_FIELDS[type]) {
        throw new context.CancelError(`Question '${id}': unknown type '${type}'. Use choice, score or noul.`);
    }
    if (isEmpty(row.instructions)) {
        throw new context.CancelError(`Question '${id}': Question is required.`);
    }

    const question = { type, instructions: row.instructions };
    if (type === 'choice') {
        question.criteria = parseOptions(context, row.options, id);
    } else if (type === 'score') {
        question.criteria = parseLevels(context, row.levels, id);
    } else {
        const criteria = {};
        if (!isEmpty(row.trueCriteria)) {
            criteria.true = row.trueCriteria;
        }
        if (!isEmpty(row.falseCriteria)) {
            criteria.false = row.falseCriteria;
        }
        if (Object.keys(criteria).length) {
            question.criteria = criteria;
        }
    }

    return { id, type, question };
};

/**
 * All rows -> questions. `lenient` is for the output port options: the designer asks
 * for them while the rows are still being typed, so a row that is not valid yet is
 * skipped instead of failing the whole call.
 * @param {object} context
 * @param {*} rows value of the Questions input
 * @param {object} [options]
 * @param {boolean} [options.lenient]
 * @returns {array<{id: string, type: string, question: object}>}
 */
const buildQuestions = (context, rows, { lenient = false } = {}) => {

    let list;
    try {
        list = lib.getRows(context, rows, 'Questions');
    } catch (error) {
        if (lenient) return [];
        throw error;
    }

    const seen = new Set();
    const questions = [];
    list.forEach(row => {
        let item;
        try {
            item = buildQuestion(context, row);
        } catch (error) {
            if (lenient) return;
            throw error;
        }
        if (seen.has(item.id)) {
            if (lenient) return;
            throw new context.CancelError(`Duplicate Question ID '${item.id}'. Question IDs must be unique.`);
        }
        seen.add(item.id);
        questions.push(item);
    });

    return questions;
};

// One variable per answer field (answers.<id>.<field>), then the common outputs.
const getOutputPortOptions = (questions) => {

    const options = [];
    questions.forEach(({ id, type }) => {
        ANSWER_FIELDS[type].forEach(([field, label, schema]) => {
            options.push({ label: `${id}.${label}`, value: `answers.${id}.${field}`, schema });
        });
    });

    return options.concat([
        { label: 'Answers', value: 'answers', schema: { type: 'object' } },
        { label: 'Model', value: 'model', schema: { type: 'string' } },
        { label: 'Usage.Input Tokens', value: 'usage.inputTokens', schema: { type: 'integer' } },
        { label: 'Usage.Output Tokens', value: 'usage.outputTokens', schema: { type: 'integer' } }
    ]);
};

// The API answer -> the fields declared in ANSWER_FIELDS, same as the single-question components.
const toOutput = (answer, { type, question }) => {

    if (type === 'choice') {
        return {
            type,
            choice: answer.choice,
            confidence: answer.confidence,
            probabilities: answer.probabilities || {}
        };
    }
    if (type === 'score') {
        return { type, ...lib.scoreOutput(answer, question.criteria) };
    }
    const probability = answer.noul;
    return {
        type,
        probability,
        result: typeof probability === 'number' && probability >= NOUL_THRESHOLD
    };
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        const { state, questions, model } = context.messages.in.content || {};

        if (context.properties && context.properties.generateOutputPortOptions) {
            return context.sendJson(
                getOutputPortOptions(buildQuestions(context, questions, { lenient: true })),
                'out'
            );
        }

        const content = lib.getState(context, state);
        const parsed = buildQuestions(context, questions);
        if (!parsed.length) {
            throw new context.CancelError('Questions is required! Add at least one question.');
        }

        // https://docs.typesafe.ai/api - one request, the questions are evaluated independently and in parallel.
        const { data } = await lib.request({
            context,
            method: 'POST',
            path: '/v1/systemone',
            data: {
                state: content,
                model: model || lib.DEFAULT_MODEL,
                questions: parsed.reduce((res, { id, question }) => {
                    res[id] = question;
                    return res;
                }, {})
            }
        });

        const answers = {};
        parsed.forEach(item => {
            const answer = data && data.answers && data.answers[item.id];
            if (!answer) {
                throw new Error(`TypeSafe returned no answer for question '${item.id}'.`);
            }
            answers[item.id] = toOutput(answer, item);
        });

        const usage = (data && data.usage) || {};

        return context.sendJson({
            answers,
            model: data.model,
            usage: {
                inputTokens: usage.input_tokens,
                outputTokens: usage.output_tokens
            }
        }, 'out');
    }
};
