'use strict';

const assert = require('assert');
const sinon = require('sinon');

const lib = require('../../../sharepoint/lib');
const ListFiles = require('../../../sharepoint/ListFiles/ListFiles');
const FindFilesOrFolders = require('../../../sharepoint/FindFilesOrFolders/FindFilesOrFolders');

class CancelError extends Error {}

// Every path the previous hand-written option list exposed on the object/first ports. The new
// options declare the nested objects instead, so the picker still reaches each of these — a flow
// that already maps one of them must keep resolving.
const LEGACY_PATHS = [
    'id',
    'name',
    'createdDateTime',
    'cTag',
    'eTag',
    'lastModifiedDateTime',
    'size',
    'webUrl',
    'createdBy.user.id',
    'createdBy.user.displayName',
    'lastModifiedBy.user.id',
    'lastModifiedBy.user.displayName',
    'parentReference.driveId',
    'parentReference.driveType',
    'parentReference.path',
    'index',
    'count'
];

function resolvePath(options, path) {

    const [head, ...rest] = path.split('.');
    const option = options.find(o => o.value === head);
    if (!option) return false;

    let schema = option.schema;
    for (const segment of rest) {
        if (!schema || schema.type !== 'object' || !schema.properties || !schema.properties[segment]) {
            return false;
        }
        schema = schema.properties[segment];
    }
    return true;
}

describe('Microsoft SharePoint driveItem output', () => {

    describe('DRIVE_ITEM_SCHEMA', () => {

        it('should require only the fields every driveItem carries', () => {

            // file/folder/shared are conditional; `required` drives FAIL vs WARN in connector verify.
            assert.deepStrictEqual(lib.DRIVE_ITEM_SCHEMA.required, ['id', 'name']);
        });

        it('should give every leaf an example', () => {

            const missing = [];

            const walk = (properties, path) => {
                for (const [key, value] of Object.entries(properties)) {
                    if (value.type === 'object' && value.properties) {
                        walk(value.properties, `${path}${key}.`);
                    } else if (!('example' in value)) {
                        missing.push(path + key);
                    }
                }
            };

            walk(lib.DRIVE_ITEM_SCHEMA.properties, '');

            assert.deepStrictEqual(missing, []);
        });

        it('should declare size as a number, the way Graph returns it', () => {

            assert.strictEqual(lib.DRIVE_ITEM_SCHEMA.properties.size.type, 'integer');
        });

        it('should be the ITEM_SCHEMA both components export', () => {

            assert.strictEqual(ListFiles.ITEM_SCHEMA, lib.DRIVE_ITEM_SCHEMA);
            assert.strictEqual(FindFilesOrFolders.ITEM_SCHEMA, lib.DRIVE_ITEM_SCHEMA);
        });
    });

    describe('buildDriveItemPortOptions', () => {

        it('should expose the records under "result" for the array output', () => {

            const options = lib.buildDriveItemPortOptions('array');

            assert.deepStrictEqual(options.map(o => o.value), ['result', 'count']);
            assert.strictEqual(options[0].schema.items, lib.DRIVE_ITEM_SCHEMA);
        });

        it('should expose only the saved file for the file output', () => {

            assert.deepStrictEqual(lib.buildDriveItemPortOptions('file').map(o => o.value), ['fileId', 'count']);
        });

        it('should keep every path the old option list exposed', () => {

            for (const outputType of ['object', 'first']) {
                const options = lib.buildDriveItemPortOptions(outputType);
                for (const path of LEGACY_PATHS) {
                    assert.ok(resolvePath(options, path), `${outputType}: ${path} is no longer reachable`);
                }
            }
        });

        it('should not leak the item title into an option schema', () => {

            // The title becomes the option label; leaving it in the schema duplicates it.
            const idOption = lib.buildDriveItemPortOptions('object').find(o => o.value === 'id');
            assert.strictEqual(idOption.label, 'Item ID');
            assert.ok(!('title' in idOption.schema));
        });
    });

    describe('ListFiles', () => {

        it('should build the options without auth or an API call', async () => {

            // This is what makes ignoreAuth=true on the out port source correct: the schema
            // branch returns before anything touches context.auth or Microsoft Graph.
            const context = {
                properties: { generateOutputPortOptions: true },
                messages: { in: { content: { outputType: 'array' } } },
                sendJson: sinon.stub().resolves()
            };

            await ListFiles.receive(context);

            assert.deepStrictEqual(
                context.sendJson.firstCall.args[0].map(o => o.value),
                ['result', 'count']
            );
            assert.strictEqual(context.sendJson.firstCall.args[1], 'out');
        });

        it('should reject a missing Drive ID', async () => {

            const context = {
                properties: {},
                messages: { in: { content: { outputType: 'array' } } },
                CancelError,
                sendJson: sinon.stub().resolves()
            };

            await assert.rejects(() => ListFiles.receive(context), /Drive ID is required/);
            assert.strictEqual(context.sendJson.callCount, 0);
        });
    });

    describe('FindFilesOrFolders', () => {

        it('should reject a missing Drive ID', async () => {

            const context = {
                messages: { in: { content: { outputType: 'array', q: 'report' } } },
                CancelError,
                sendJson: sinon.stub().resolves()
            };

            await assert.rejects(() => FindFilesOrFolders.receive(context), /Drive ID is required/);
            assert.strictEqual(context.sendJson.callCount, 0);
        });
    });
});
