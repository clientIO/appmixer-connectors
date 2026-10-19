'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const moment = require('moment');
const sinon = require('sinon');

// Load the quota module the way the engine's quota ManagerLoader does:
// a CommonJS source compiled with `moment` injected as a global.
function loadQuota() {

    const source = fs.readFileSync(path.join(__dirname, '../../shares/quota.js'), 'utf8');
    const sandboxModule = { exports: {} };
    vm.compileFunction(source, ['module', 'exports', 'moment', 'console'])(
        sandboxModule, sandboxModule.exports, moment, console
    );
    return sandboxModule.exports;
}

const DAY = 24 * 60 * 60 * 1000;

describe('linkedin shares quota', function() {

    afterEach(function() {
        sinon.restore();
    });

    it('gives every fixed-window rule a window the quota server can key on', function() {

        const fixedRules = loadQuota().rules.filter(rule => rule.throttling && rule.throttling.type === 'window-fixed');
        assert.strictEqual(fixedRules.length, 1);

        fixedRules.forEach(rule => {
            // Same computation as the engine's KeyBuilder.calculateWindowBoundary().
            const windowStart = Math.floor(Date.now() / rule.window) * rule.window;
            assert.doesNotThrow(() => new Date(windowStart).toISOString());
        });
    });

    [
        ['2026-09-16T03:00:00Z', '2026-09-16T08:00:00Z'],
        ['2026-09-16T08:00:00Z', '2026-09-17T08:00:00Z'],
        ['2026-09-16T20:30:00Z', '2026-09-17T08:00:00Z']
    ].forEach(([now, expected]) => {
        it(`resets the app quota at the next 08:00 UTC (now ${now})`, function() {

            sinon.useFakeTimers(new Date(now));
            const rule = loadQuota().rules.find(r => r.throttling && r.throttling.type === 'window-fixed');
            const next = rule.throttling.getStartOfNextWindow();

            assert.strictEqual(new Date(next).toISOString(), new Date(expected).toISOString());
            assert.ok(next - Date.now() > 0 && next - Date.now() <= DAY);
        });
    });
});
