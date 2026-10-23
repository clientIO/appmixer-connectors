'use strict';
/* eslint-disable no-underscore-dangle */

// google.spreadsheets.CreateRow: issue #1393. An object or array mapped into a column
// was sent to values.append unchanged; Google rejected the row with 400
// "Invalid values[...]: list_value" and the engine retried it until the retry limit.

const assert = require('assert');
const path = require('path');
const Module = require('module');
const sinon = require('sinon');
const { createMockContext } = require('../../utils');

const COMPONENT = path.join(__dirname, '../../../src/appmixer/google/spreadsheets/CreateRow/CreateRow.js');

describe('google.spreadsheets.CreateRow', function() {

    let originalLoad;
    let getStub;
    let appendStub;
    let CreateRow;
    let common;

    before(function() {
        // The Google connector's dependencies are installed per connector, not at the repo root.
        // Replace them with small fakes: values.get/values.append use the node callback style.
        getStub = sinon.stub();
        appendStub = sinon.stub();
        const fakes = {
            googleapis: {
                sheets: () => ({ spreadsheets: { values: { get: getStub, append: appendStub } } }),
                auth: { OAuth2: function OAuth2() {} }
            },
            'google-auth-library': { OAuth2Client: function OAuth2Client() {} },
            'google-spreadsheet': { GoogleSpreadsheet: function GoogleSpreadsheet() {} },
            '@fast-csv/parse': { parse: () => {} },
            bluebird: {
                promisify: (fn, { context } = {}) => (...args) => new Promise((resolve, reject) => {
                    fn.call(context, ...args, (err, res) => err ? reject(err) : resolve(res));
                })
            }
        };
        originalLoad = Module._load;
        Module._load = function(request, ...rest) {
            if (Object.prototype.hasOwnProperty.call(fakes, request)) return fakes[request];
            return originalLoad.call(this, request, ...rest);
        };
        CreateRow = require(COMPONENT);
        common = require(path.join(path.dirname(COMPONENT), '../common'));
    });

    after(function() {
        Module._load = originalLoad;
        // Drop the modules loaded with fakes so no other test gets them from the cache.
        const spreadsheets = path.dirname(path.dirname(COMPONENT));
        Object.keys(require.cache)
            .filter(file => file.startsWith(path.dirname(spreadsheets)))
            .forEach(file => delete require.cache[file]);
    });

    let context;

    beforeEach(function() {
        getStub.reset();
        appendStub.reset();
        getStub.callsFake((params, cb) => cb(null, { values: [['Name', 'Stays', 'Count', 'Active', 'Tags']] }));
        appendStub.callsFake((params, cb) => cb(null, {
            updates: {
                spreadsheetId: 'sheet-1',
                updatedRange: 'Sheet1!A2:E2',
                updatedRows: 1,
                updatedColumns: 5,
                updatedCells: 5
            }
        }));
        context = createMockContext();
        context.auth = { clientId: 'id', clientSecret: 'secret', accessToken: 'token' };
        context.properties = { sheetId: 'sheet-1', worksheetId: '0/Sheet1' };
    });

    const sentRow = () => appendStub.firstCall.args[0].resource.values[0];

    it('writes an object or array value as a JSON string', async function() {
        context.messages = { in: { content: {
            Name: 'A',
            Stays: [{ name: 'A', nights: 2 }],
            Tags: { first: 'x' }
        } } };

        await CreateRow.receive(context);

        assert.deepStrictEqual(sentRow(), ['A', '[{"name":"A","nights":2}]', '', '', '{"first":"x"}']);
        assert(context.sendJson.calledOnce);
        assert.strictEqual(context.sendJson.firstCall.args[1], 'createdRow');
    });

    it('passes strings, numbers and booleans through unchanged, including 0 and false', async function() {
        context.messages = { in: { content: { Name: 'B', Stays: '', Count: 0, Active: false, Tags: 7 } } };

        await CreateRow.receive(context);

        assert.deepStrictEqual(sentRow(), ['B', '', 0, false, 7]);
    });

    it('writes null and missing values as an empty cell', async function() {
        context.messages = { in: { content: { Name: null } } };

        await CreateRow.receive(context);

        assert.deepStrictEqual(sentRow(), ['', '', '', '', '']);
    });

    it('turns a 400 from values.append into a CancelError', async function() {
        appendStub.callsFake((params, cb) => {
            const err = new Error('Invalid values[1][1]: list_value');
            err.code = 400;
            cb(err);
        });
        context.messages = { in: { content: { Name: 'C' } } };

        await assert.rejects(CreateRow.receive(context), err => {
            assert.strictEqual(err.name, 'CancelError');
            assert(err.message.includes('Invalid values[1][1]'));
            return true;
        });
    });

    it('rethrows other errors unchanged so the engine can retry them', async function() {
        appendStub.callsFake((params, cb) => {
            const err = new Error('Backend Error');
            err.code = 503;
            cb(err);
        });
        context.messages = { in: { content: { Name: 'D' } } };

        await assert.rejects(CreateRow.receive(context), err => {
            assert.notStrictEqual(err.name, 'CancelError');
            assert.strictEqual(err.message, 'Backend Error');
            return true;
        });
    });

    describe('common.toCellValue', function() {

        it('converts only objects and arrays', function() {
            assert.strictEqual(common.toCellValue({ a: 1 }), '{"a":1}');
            assert.strictEqual(common.toCellValue([1, 2]), '[1,2]');
            assert.strictEqual(common.toCellValue('text'), 'text');
            assert.strictEqual(common.toCellValue(0), 0);
            assert.strictEqual(common.toCellValue(false), false);
            assert.strictEqual(common.toCellValue(true), true);
            assert.strictEqual(common.toCellValue(null), '');
            assert.strictEqual(common.toCellValue(undefined), '');
        });
    });

    describe('common.isBadRequestError', function() {

        it('recognises a 400 in err.code, err.status or err.response.status', function() {
            const isBadRequest = common.isBadRequestError;
            assert.strictEqual(common.isBadRequestError(Object.assign(new Error(), { code: 400 })), true);
            assert.strictEqual(common.isBadRequestError(Object.assign(new Error(), { status: 400 })), true);
            assert.strictEqual(isBadRequest(Object.assign(new Error(), { response: { status: 400 } })), true);
            assert.strictEqual(common.isBadRequestError(Object.assign(new Error(), { code: 429 })), false);
            assert.strictEqual(common.isBadRequestError(Object.assign(new Error(), { code: 'ECONNRESET' })), false);
            assert.strictEqual(common.isBadRequestError(undefined), false);
        });
    });
});
