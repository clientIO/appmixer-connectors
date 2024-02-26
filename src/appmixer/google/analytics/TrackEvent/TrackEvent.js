'use strict';
const { getHitURL } = require('../google-analytics');
const request = require('request-promise');

/**
 * Analytics send Event Hit component.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const tid = context.properties.tid;  // Tracking ID
        const params = context.messages.in.content;
        const url = getHitURL('event', tid, params);

        return request({ method: 'POST', url }).then(res => {
            return context.sendJson(Object.assign({ tid }, params), 'hit');
        });
    }
};
