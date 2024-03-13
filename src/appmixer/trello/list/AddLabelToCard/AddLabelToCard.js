'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Build label data.
 * @param {Object} label
 * @return {Object} labelObject
 */
function buildLabel(label) {

    let labelObject = {};

    labelObject['color'] = label['labelColor'] === 'none' ? null : label['labelColor'];
    labelObject['name'] = label['labelName'] ? label['labelName'] : undefined;

    return labelObject;
}

/**
 * Component for adding a label to card.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        let labelInfo = context.messages.in.content;
        let boardListCardId = labelInfo.boardListCardId;
        delete labelInfo.boardListCardId;
        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let addLabelToCard = Promise.promisify(client.post, { context: client });

        let url;
        let query;
        if (labelInfo.labelId) {
            url = '/1/cards/' + boardListCardId + '/idLabels';
            query = { value: labelInfo.labelId };
        } else {
            url = '/1/cards/' + boardListCardId + '/labels';
            query = buildLabel(labelInfo);
        }

        return addLabelToCard(url, query).then(async result => {
            if (Array.isArray(result)) {
                const { data } = await context.httpRequest({
                    headers: { 'Content-Type': 'application/json' },
                    url: `https://api.trello.com/1/labels/${labelInfo.labelId}?${commons.getAuthQueryParams(context)}`
                });
                data.idCard = boardListCardId;
                return data;
            }

            result.idCard = boardListCardId;
            return result;
        }).then(result => {
            return context.sendJson(result, 'label');
        });
    }
};

