'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Build attachment data.
 * @param {Object} attachment
 * @return {Object} attachmentObject
 */
function buildAttach(attachment) {

    let attachmentObject = {};

    attachmentObject['url'] = attachment['url'] ? attachment['url'] : null;
    attachmentObject['name'] = attachment['name'] ? attachment['name'] : undefined;

    return attachmentObject;
}

/**
 * Component for adding an attachment to card
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let attachInfo = context.messages.in.content;
        let boardListCardId = attachInfo.boardListCardId;
        delete attachInfo.boardListCardId;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let addAttachmentToCard = Promise.promisify(client.post, { context: client });

        return addAttachmentToCard(
            '/1/cards/' + boardListCardId + '/attachments',
            buildAttach(attachInfo)
        ).then(newAttachment => {
            return context.sendJson(newAttachment, 'attachment');
        });
    }
};

