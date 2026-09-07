'use strict';

const { createMutexLock } = require('../../../../../test/utils.js');

/**
 * Lean mock of the component context for the wiz tests. State is array-backed
 * (matching how UploadScan uses stateAddToSet/stateGet/stateSet together),
 * context.lock is a real in-process mutex and context.setTimeout only records
 * the scheduled timeouts so tests can replay them like the engine would.
 */
function createWizContext({ httpRequest, config = {}, properties = {} } = {}) {

    const state = {};
    const lock = createMutexLock();
    let timeoutCounter = 0;

    const context = {
        auth: { url: 'https://api.mock.wiz/graphql', token: 'test-token' },
        componentId: 'componentId-1',
        config,
        properties,
        messages: {},
        httpRequest,

        logs: [],
        sent: [],
        scheduledTimeouts: [],

        CancelError: class CancelError extends Error {
            constructor(...args) {
                super(typeof args[0] === 'string' ? args[0] : JSON.stringify(args[0]));
                this.name = 'CancelError';
            }
        },

        log(entry) { context.logs.push(entry); },
        sendJson(payload, port) { context.sent.push({ port, payload }); return { payload, port }; },
        sendArray(records, port) { context.sent.push({ port, records }); return { records, port }; },

        async stateGet(key) { return state[key]; },
        async stateSet(key, value) { state[key] = value; },
        async stateUnset(key) { delete state[key]; },
        async stateAddToSet(key, value) { state[key] = (state[key] || []).concat([value]); },

        lock(key, options) { return lock(key, options); },

        async setTimeout(payload, delay) {
            const timeoutId = `timeout-${++timeoutCounter}`;
            context.scheduledTimeouts.push({ timeoutId, payload, delay });
            return timeoutId;
        },

        _state: state
    };

    return context;
}

module.exports = { createWizContext };
