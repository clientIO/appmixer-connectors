'use strict';
const commons = require('../../userengage-commons');

/**
 * Build user.
 * @param {Object} user
 * @return {Object} userObject
 */
function buildUser(user) {

    let userObject = {};

    if (user['firstName']) {
        userObject['first_name'] = user['firstName'];
    }

    if (user['lastName']) {
        userObject['last_name'] = user['lastName'];
    }

    if (user['email']) {
        userObject['email'] = user['email'];
    }

    if (user['phoneNumber']) {
        userObject['phone_number'] = user['phoneNumber'];
    }

    if (user['city']) {
        userObject['city'] = user['city'];
    }

    if (user['country']) {
        userObject['country'] = user['country'];
    }

    if (user['browser']) {
        userObject['browser'] = user['browser'];
    }

    if (user['osType']) {
        userObject['os_type'] = user['osType'];
    }

    if (user['resolution']) {
        userObject['resolution'] = user['resolution'];
    }

    if (user['gravatarUrl']) {
        userObject['gravatar_url'] = user['gravatarUrl'];
    }

    if (user['facebookUrl']) {
        userObject['facebook_url'] = user['facebookUrl'];
    }

    if (user['linkedinUrl']) {
        userObject['linkedin_url'] = user['linkedinUrl'];
    }

    if (user['twitterUrl']) {
        userObject['twitter_url'] = user['twitterUrl'];
    }

    if (user['googleUrl']) {
        userObject['google_url'] = user['googleUrl'];
    }

    return userObject;
}

/**
 * Update user in UserEngage.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;
        let id = context.messages.user.userId;
        let user = context.messages.user.content;
        let data = buildUser(user);

        return commons.getUserengageRequest(apiKey, 'users/' + id, 'PUT', data, 'body')
            .then(user => {
                if (user) {
                    // make CSV out of array properties
                    user.tags = Array.isArray(user.tags) ? user.tags.join(',') : '';
                    user.lists = Array.isArray(user.lists) ? user.lists.join(',') : '';
                    return context.sendJson(user, 'updatedUser');
                }
            });
    }
};

