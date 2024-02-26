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
        let { place } = context.properties;

        let places = await paging.fetch('/search?q=' + encodeURIComponent(place) + '&type=place');

        return Promise.map(places, place => {
            return context.sendJson(place, 'place');
        });
    },

    toSelectArray(places) {

        let transformed = [];

        if (Array.isArray(places)) {
            places.forEach(place => {

                transformed.push({
                    label: place['name'],
                    value: place['id']
                });
            });
        }

        return transformed;
    }
};
