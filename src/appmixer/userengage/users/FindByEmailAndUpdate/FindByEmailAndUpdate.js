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
 * Find user by email.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { apiKey } = context.auth;
        let qs = {
            email: context.messages.in.content.email
        };
        let user = context.messages.in.content;

        return commons.getUserengageRequest(apiKey, 'users/search', 'GET', qs, 'qs')
            .then(result => {
                // because their API cannot update email of a user to the same email :)
                if (user.email === result.email) {
                    delete user['email'];
                }
                return commons.getUserengageRequest(apiKey, 'users/' + result.id, 'PUT', buildUser(user), 'body');
            })
            .then(response => {
                return context.sendJson(response, 'user');
            });
    }
};
