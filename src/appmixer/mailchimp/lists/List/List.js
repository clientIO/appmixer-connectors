'use strict';
const mailchimpDriver = require('../../commons');

/**
 * Component listing subscribers
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const { listId } = context.messages.in.content;
        return mailchimpDriver.lists.list(context, {
            listId
        }).then(data => {
            return context.sendJson(data, 'out');
        });
    }
};
