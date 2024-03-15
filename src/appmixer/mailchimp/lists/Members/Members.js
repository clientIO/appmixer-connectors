'use strict';
const mailchimp = require('../../mailchimp-commons');

/**
 * Component gets members of a list.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { listId } = context.properties;

        return mailchimp.getMembers({
            dc: context.profileInfo.dc,
            accessToken: context.auth.accessToken,
            listId
        }).then(response => {
            return context.sendJson(response, 'out');
        });
    }
};
