'use strict';
const url = require('url');
const moment = require('moment');
const request = require('request');

module.exports = {

    tick(context) {

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
            }, async (err, response, body) => {
                try {
                    if (err) {
                        await onDown(href, context, err.status);
                    } else if ((response.statusCode + '')[0] === '5') {
                        await onDown(href, context, response.statusCode);
                    } else {
                        await onUp(href, context, response.statusCode);
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
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
