'use strict';
const url = require('url');
const moment = require('moment');
const request = require('request');

// Shared by tick() and test(): probe the configured target with a single read-only GET
// and classify it as up/down using the same rules tick() applies.
function probeTarget(context) {

    const target = url.parse(context.properties.target);
    const href = target.href;
    const protocol = target.protocol;

    return new Promise((resolve, reject) => {
        if (protocol !== 'http:' && protocol !== 'https:') {
            return reject(new Error('Unknown protocol ' + protocol));
        }
        request({
            method: 'GET',
            url: href
        }, (err, response) => {
            if (err) {
                return resolve({ href, isUp: false, statusCode: err.status });
            }
            if ((response.statusCode + '')[0] === '5') {
                return resolve({ href, isUp: false, statusCode: response.statusCode });
            }
            return resolve({ href, isUp: true, statusCode: response.statusCode });
        });
    });
}

module.exports = {

    async tick(context) {

        const { href, isUp, statusCode } = await probeTarget(context);
        if (isUp) {
            await onUp(href, context, statusCode);
        } else {
            await onDown(href, context, statusCode);
        }
    },

    async test(context) {

        // Polling-with-source: reuse the same probe tick() uses and emit a single payload
        // on the same port (up/down) that production would emit for the current target
        // status, shaped identically. No state read/write.
        const { href, isUp, statusCode } = await probeTarget(context);

        if (isUp) {
            return context.sendJson({ target: href, statusCode }, 'up');
        }
        return context.sendJson({ target: href, statusCode }, 'down');
    }
};

async function onUp(href, context, statusCode) {

    let monitor = context.state.monitor || {};
    let previousMonitor = monitor;
    monitor = {
        status: 'up',
        t: (new Date).getTime()
    };
    if (!previousMonitor.status || previousMonitor.status === 'down') {
        let output = {
            target: href,
            statusCode: statusCode
        };

        if (previousMonitor) {
            const now = (new Date).getTime();
            const downTimeMs = now - previousMonitor.t;
            output.downTimeMs = downTimeMs;
            output.downTimeText = moment.duration(downTimeMs).humanize();
        }

        await context.sendJson(output, 'up');
    }
    await context.saveState({ monitor: monitor });
}

async function onDown(href, context, statusCode) {

    let monitor = context.state.monitor || {};
    let previousMonitor = monitor;
    monitor = {
        status: 'down',
        t: (new Date).getTime()
    };
    await context.saveState({ monitor: monitor });
    if (!previousMonitor.status || previousMonitor.status === 'up') {
        await context.sendJson({
            target: href,
            statusCode: statusCode
        }, 'down');
    }
}
