'use strict';
const commons = require('../../trello-commons');

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

    async receive(context) {

        let attachInfo = context.messages.in.content;
        let boardListCardId = attachInfo.boardListCardId;
        delete attachInfo.boardListCardId;

        const { data } = await context.httpRequest({
            data: buildAttach(attachInfo),
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com/1/cards/${boardListCardId}/attachments?${commons.getAuthQueryParams(context)}`
        });

        return context.sendJson(data, 'attachment');
    }
};

