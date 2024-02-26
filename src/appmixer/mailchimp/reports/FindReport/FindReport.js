'use strict';
const mailchimpDriver = require('../../commons');

/**
 * Component gets members of a list.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { campaignId } = context.messages.in.content;

        return mailchimpDriver.reports.findReport(context, {
            campaignId
        }).then(response => {
            return context.sendJson(response, 'report');
        });
    }
};
