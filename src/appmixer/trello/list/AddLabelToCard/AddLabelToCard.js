'use strict';
const commons = require('../../trello-commons');

/**
 * Build label data.
 * @param {Object} label
 * @return {Object} labelObject
 */
function buildLabel(label) {

    let labelObject = {};

    labelObject['color'] = label['labelColor'] === 'none' ? null : (label['labelColor'] === '#006988' ? 'sky' : label['labelColor']);
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

        let url;
        let query;
        if (labelInfo.labelId) {
            url = '/1/cards/' + boardListCardId + '/idLabels';
            query = { value: labelInfo.labelId };
        } else {
            url = '/1/cards/' + boardListCardId + '/labels';
            query = buildLabel(labelInfo);
        }

        const { data: result } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            method: 'POST',
            url: `https://api.trello.com${url}?${commons.getAuthQueryParams(context)}`,
            data: query
        });

        if (Array.isArray(result)) {
            const { data } = await context.httpRequest({
                headers: { 'Content-Type': 'application/json' },
                url: `https://api.trello.com/1/labels/${labelInfo.labelId}?${commons.getAuthQueryParams(context)}`
            });
            data.idCard = boardListCardId;
            return context.sendJson(data, 'label');
        } else {
            result.idCard = boardListCardId;
        }

        return context.sendJson(result, 'label');
    }
};
