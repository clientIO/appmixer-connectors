'use strict';
const moment = require('moment');

/**
 * @extend {Component}
 */
module.exports = {

    receive(context) {

        if (context.messages.timeout) { // timeout message
            return context.sendJson(context.messages.timeout.content, 'out');
        } else { // input message
            const now = Date.now();
            let { interval, until } = context.messages.in.content;
            let expiredDate;
            if (interval) {
                interval = interval.trim();
                const unit = interval[interval.length - 1];
                const intervalValue = parseFloat(interval.substr(0, interval.length - 1));
                expiredDate = moment(new Date(now)).add(intervalValue, unit).toDate();
            } else {
                expiredDate = moment(until).toDate();
            }

            return context.setTimeout(
                context.messages.in.content,
                expiredDate - now
            );
        }
    }
};
