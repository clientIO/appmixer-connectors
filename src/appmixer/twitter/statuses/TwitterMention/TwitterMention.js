'use strict';
const commons = require('../../twitter-commons');
const Promise = require('bluebird');

/**
 * Twitter mention component.
 */
module.exports = {

    async tick(context) {

        let state = context.state;
        if (!state.lastId) {
            // this is the first time TwitterMention is called, we have to init
            // component's state - set the lastId
            return this.initState(context);
        }

        let params = {
            'count': context.properties.maxAtOnce,
            'since_id': state.lastId
        };

        let data = await commons.getTwitterApi(context.auth).getTimelineAsync(
            'mentions',
            params,
            context.auth.accessToken,
            context.auth.accessTokenSecret
        );
        let lastId = data.length ? data[0]['id_str'] : null;
        await Promise.map(data, mention => {
            return context.sendJson(mention, 'out');
        });
        if (lastId) {
            await context.saveState({ lastId: lastId });
        }
    },

    initState(context) {

        return commons.getTwitterApi(context.auth).getTimelineAsync(
            'mentions',
            { count: 1 },
            context.auth.accessToken,
            context.auth.accessTokenSecret
        ).then(data => {
            if (data.length) {
                return context.saveState({ lastId: data[0]['id_str'] });
            } else {
                return context.saveState({ lastId: 0 });
            }
        });
    }
};
