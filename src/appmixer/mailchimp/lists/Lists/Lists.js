'use strict';
const mailchimpDriver = require('../../commons');

/**
 * Recursively get all the users mailchimp lists. Mailchimp uses pagination for
 * the API, by default it's set to get 1000 lists at a time, which should be enough
 * for all users, but if not, here's a recursive alg that will get all the lists.
 * @param dc
 * @param accessToken
 * @param result
 * @param offset
 * @param count
 * @returns {Promise}
 */
let getLists = (context, result, offset = 0, count = 1000) => {

    return mailchimpDriver.lists.lists(
        context,
        {
            count: count,
            offset: offset
        })
        .then(data => {
            result.lists = result.lists.concat(data.lists);
            if (result.lists.length < data['total_items']) {
                return getLists(context, result, offset + count);
            }
            return result;
        });
};

/**
 * Component listing lists
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return getLists(context, { lists: [] })
            .then(lists => {
                return context.sendJson(lists, 'out');
            });
    }
};

