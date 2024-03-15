'use strict';
const commons = require('../../twitter-commons');
const Promise = require('bluebird');

/**
 * Trigger Search mention on Twitter.
 */
module.exports = {

    async tick(context) {

        let params = { q: commons.escape(context.properties.query) };

        if (context.properties.geocode) {
            params['geocode'] = context.properties.geocode;
        }
        if (context.properties.lang) {
            params['lang'] = context.properties.lang;
        }
        if (context.properties.resultType) {
            params['result_type'] = context.properties.resultType;
        }
        if (context.properties.count) {
            params['count'] = context.properties.count;
        }
        if (context.properties.until) {
            params['until'] = context.properties.until;
        }

        let state = context.state;

        if (!state.hasOwnProperty('sinceId')) {
            // this is the first time TwitterMention is called, we have to init
            // component's state - set the lastId
            return this.initState(context, params);
        }

        params['since_id'] = state.sinceId;

        let data = await commons.getTwitterApi(context.auth).searchAsync(
            params,
            context.auth.accessToken,
            context.auth.accessTokenSecret
        );
        let statusIds = [];
        await Promise.map(data.statuses, status => {
            statusIds.push(parseInt(status['id_str']));
            return context.sendJson(status, 'out');
        });

        let sinceId = null;
        if (data['search_metadata']['max_id'] == 0) {
            if (statusIds.length > 0) {
                sinceId = Math.max.apply(null, statusIds);
            }
        } else {
            sinceId = data['search_metadata']['max_id_str'];
        }

        if (sinceId) {
            await context.saveState({ sinceId: sinceId });
        }
    },

    initState(context, params) {

        params['count'] = 1;
        return commons.getTwitterApi(context.auth).searchAsync(
            params,
            context.auth.accessToken,
            context.auth.accessTokenSecret
        ).then(data => {
            if (data.statuses.length) {
                return context.saveState({ sinceId: data.statuses[0]['id_str'] });
            } else {
                return context.saveState({ sinceId: 0 });
            }
        });
    }
};
