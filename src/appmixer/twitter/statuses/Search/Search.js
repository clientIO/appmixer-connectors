'use strict';
const commons = require('../../twitter-commons');
const Promise = require('bluebird');

/**
 * Twitter search statuses component.
 */
module.exports = {

    receive(context) {

        let searchOptions = context.messages.in.content;
        let params = { q: commons.escape(searchOptions.query) };

        if (searchOptions.geocode) {
            params['geocode'] = (searchOptions.geocode || '').replace(/\s/g, '');
        }
        if (searchOptions.lang) {
            params['lang'] = searchOptions.lang;
        }
        if (searchOptions.resultType) {
            params['result_type'] = searchOptions.resultType;
        }
        if (searchOptions.count) {
            params['count'] = searchOptions.count;
        }
        if (searchOptions.until) {
            params['until'] = searchOptions.until;
        }
        if (searchOptions.sinceId) {
            params['since_id'] = searchOptions.sinceId;
        }
        if (searchOptions.maxId) {
            params['max_id'] = searchOptions.maxId;
        }

        return commons.getTwitterApi(context.auth).searchAsync(
            params,
            context.auth.accessToken,
            context.auth.accessTokenSecret
        ).then(data => {
            return Promise.map(data.statuses, status => {
                return context.sendJson(status, 'out');
            });
        });
    }
};
