'use strict';
const commons = require('../../wordpress-commons');

/**
 * Component for fetching list of posts
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const siteId = context.properties.siteId;

        return commons.getBlogPosts({ siteId: siteId })
            .then(response => {
                return context.sendJson(response, 'posts');
            });
    }
};
