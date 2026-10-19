const assert = require('assert');
const ZohoClient = require('../../ZohoClient');

// Client whose every API request fails with the HTTP status and Zoho error body given.
function clientRefusing(status, data) {

    const httpRequest = () => {};
    httpRequest.create = () => async () => {
        const err = new Error(`Request failed with status code ${status}`);
        err.response = { status, data };
        throw err;
    };
    return new ZohoClient({ auth: { accessToken: 'token' }, profileInfo: { region: 'eu' }, httpRequest });
}

const INVALID_MODULE = {
    code: 'INVALID_MODULE', details: {}, message: 'the module name given seems to be invalid', status: 'error'
};
const NO_PERMISSION = {
    code: 'NO_PERMISSION', details: {}, message: 'permission denied to access the module', status: 'error'
};

describe('Zoho module errors', () => {

    it('should add the request and a hint to INVALID_MODULE', async () => {

        await assert.rejects(clientRefusing(400, INVALID_MODULE).getRecords('Cases'), err => {
            assert.match(err.message, /^the module name given seems to be invalid \(GET \/crm\/v2\/Cases\)\. /);
            assert.match(err.message, /not in its edition/);
            assert.deepStrictEqual({ ...err, message: INVALID_MODULE.message }, INVALID_MODULE);
            return true;
        });
    });

    it('should add the request and a hint to NO_PERMISSION on a module, also from an array answer', async () => {

        await assert.rejects(clientRefusing(403, [NO_PERMISSION]).getRecords('Appointments__s'), err => {
            assert.match(err.message, /^permission denied to access the module \(GET \/crm\/v2\/Appointments__s\)\. /);
            assert.match(err.message, /profile of the connected Zoho user/);
            assert.strictEqual(err.code, 'NO_PERMISSION');
            return true;
        });
    });

    it('should leave other errors as Zoho sent them', async () => {

        const errors = [
            { code: 'INVALID_DATA', details: { id: '1' }, message: 'the id given seems to be invalid', status: 'error' },
            { code: 'NO_PERMISSION', details: {}, message: 'permission denied', status: 'error' },
            { code: 57, message: 'You are not authorized to perform this operation' }
        ];
        for (const data of errors) {
            await assert.rejects(clientRefusing(400, data).getRecords('Cases'), err => {
                assert.deepStrictEqual(err, data);
                return true;
            });
        }
    });
});
