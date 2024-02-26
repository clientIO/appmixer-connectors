'use strict';
const request = require('request-promise');
const { getHitURL } = require('../google-analytics');

/**
 * Analytics send Timing Hit component.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const tid = context.properties.tid;  // Tracking ID
        const params = context.messages.in.content;
        const url = getHitURL('timing', tid, params);

        return request({ method: 'POST', url }).then(res => {
            return context.sendJson(Object.assign({ tid }, params), 'hit');
        });
    }
};
