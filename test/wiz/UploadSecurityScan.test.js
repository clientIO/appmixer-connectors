const assert = require('assert');
const testUtils = require('../utils.js');
const lib = require('../../src/appmixer/wiz/lib');

describe('wiz upload security scan status', () => {

    let context = testUtils.createMockContext();

    it('success - should not throw an error', async () => {

        const sample = {
            'id': '36a2ea2c-8081-53e5-858e-3497a8a7c1f4',
            'status': 'SUCCESS',
            'statusInfo': null,
            'result': {
                'dataSources': { 'incoming': 1, 'handled': 1 },
                'findings': { 'incoming': 2, 'handled': 2 },
                'events': { 'incoming': 0, 'handled': 0 },
                'tags': { 'incoming': 0, 'handled': 0 }
            },
            'context': {
                'fileUploadId': '1387569'
            }
        };

        lib.validateUploadStatus(context, { systemActivity: sample });
    });

    it('any handled < incoming', async () => {

        const sample = {
            'id': '36a2ea2c-8081-53e5-858e-3497a8a7c1f4',
            'status': 'SUCCESS',
            'statusInfo': null,
            'result': {
                'dataSources': { 'incoming': 1, 'handled': 1 },
                'findings': { 'incoming': 2, 'handled': 0 },
                'events': { 'incoming': 0, 'handled': 0 },
                'tags': { 'incoming': 0, 'handled': 0 }
            },
            'context': {
                'fileUploadId': '1387569'
            }
        };

        assert.throws(() => {
            lib.validateUploadStatus(context, { systemActivity: sample });
        });
    });

    it('status is not success', async () => {

        const sample = {
            'id': '36a2ea2c-8081-53e5-858e-3497a8a7c1f4',
            'status': 'FAILURE',
            'statusInfo': null,
            'result': {},
            'context': {
                'fileUploadId': '1387569'
            }
        };

        assert.throws(() => {
            lib.validateUploadStatus(context, { systemActivity: sample });
        });
    });

    it('invalid response', async () => {

        const sample = {
            'id': '36a2ea2c-8081-53e5-858e-3497a8a7c1f4',
            'context': {
                'fileUploadId': '1387569'
            }
        };

        assert.throws(() => {
            lib.validateUploadStatus(context, { systemActivity: sample });
        });
    });

});
