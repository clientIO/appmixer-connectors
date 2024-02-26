'use strict';
const graph = require('fbgraph');
const Promise = require('bluebird');
const CursorPaging = require('../../lib').CursorPaging;

module.exports = {

    async receive(context) {

        graph.setVersion('3.2');
        let client = graph.setAccessToken(context.auth.accessToken);
        let get = Promise.promisify(client.get, { context: client });
        let paging = new CursorPaging(get);
        return context.sendJson(await paging.fetch('/me/accounts'), 'pages');
    },

    toSelectArray(pages) {

        let transformed = [];

        if (Array.isArray(pages)) {
            pages.forEach(page => {

                transformed.push({
                    label: page['name'],
                    value: page['id']
                });
            });
        }

        return transformed;
    }
};
