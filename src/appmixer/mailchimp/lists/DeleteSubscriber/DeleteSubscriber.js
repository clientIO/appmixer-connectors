'use strict';
const mailchimpDriver = require('../../commons');

/**
 * Component deletes subscriber of a list.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { listId, subscriberId } = context.messages.in.content;

        return mailchimpDriver.lists.deleteSubscriber(context, {
            listId,
            subscriberId
        }).then(() => {
            return context.sendJson({ id: subscriberId }, 'deletedSubscriber');
        });
    }
};
