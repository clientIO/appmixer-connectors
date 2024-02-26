'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for finding specific board according to name.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let getRequest = Promise.promisify(client.get, { context: client });

        return getRequest(
            '/1/members/me/boards'
        ).then(res => {
            return Promise.map(res, board => {
                if (board['name'].indexOf(context.messages.in.content.name) > -1) {
                    return getRequest(
                        `/1/boards/${board['id']}`
                    ).then(res => {
                        return context.sendJson(res, 'board');
                    });
                } else {
                    return context.sendJson({ searchTerm: context.messages.in.content.name }, 'notFound');
                }
            });
        });
    }
};

