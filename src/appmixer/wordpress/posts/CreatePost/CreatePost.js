'use strict';
const commons = require('../../wordpress-commons');
const _ = require('lodash');

/**
 * Component which creates a new post if triggered.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { siteId } = context.properties;
        let post = context.messages.post.content;
        let postObj = Object.assign({}, _.mapKeys(post, (value, key) => {
            return _.snakeCase(key);
        }));

        return commons.createNewPost(siteId, postObj, context.auth.accessToken)
            .then(result => {
                return context.sendJson(result, 'newPost');
            });
    }
};
