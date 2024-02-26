'use strict';
const request = require('../http-commons');

/**
 * This component is used to send HTTP request
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return request('PUT', context.messages.in.content)
            .then(response  => {
                return context.sendJson(response , 'response');
            });
    }
};
