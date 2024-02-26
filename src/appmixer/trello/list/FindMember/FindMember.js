'use strict';
const commons = require('../../trello-commons');
const Promise = require('bluebird');

/**
 * Component for finding specific member of a board.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getTrelloAPI(context.auth.consumerKey, context.auth.accessToken);
        let getRequest = Promise.promisify(client.get, { context: client });
        let { name, boardId } = context.messages.in.content;

        return new Promise((resolve, reject) => {

            if (!boardId) {
                return getRequest('/1/members/me/boards')
                    .then(boards => {
                        return resolve(boards.map(board => {
                            return board.id;
                        }));
                    });
            }
            resolve([boardId]);
        }).then(boards => {
            return Promise.map(boards, boardId => {
                return getRequest(`/1/boards/${boardId}/members`);
            });
        }).then(members => {
            // we get array of arrays of objects, let get one array of members
            members = [].concat(...members).filter((member, index, arr) => {
                return arr.findIndex(m => m.id === member.id) === index;
            });

            // we get array of members, let find member by name
            members = members.filter(member => {
                return name === member['fullName'];
            });

            if (!members.length) {
                return context.sendJson({ name }, 'notFound');
            }

            return Promise.map(members, member => {
                return getRequest(`/1/members/${member['id']}`).then(res => {
                    return context.sendJson(res, 'member');
                });
            });
        });
    }
};
