'use strict';
const commons = require('../../twitter-commons');
const Promise = require('bluebird');

/**
 * Initialize the state, get the newest 5000 follower ids and store them into DB.
 * This will be later used to determine new followers.
 * 5000 should be enough, the next calls will get max 200 followers with every tick.
 * @param {Context} context
 */
function init(context) {

    let params = {
        count: 5000,
        'stringify_ids': true
    };

    if (context.properties.screenName) {
        params['screen_name'] = context.properties.screenName;
    }

    return new Promise((resolve, reject) => {
        commons.getTwitterApi(context.auth).followers(
            'ids',
            params,
            context.auth.accessToken,
            context.auth.accessTokenSecret,
            (error, data) => {
                if (error) {
                    reject(new context.CancelError(error));
                }
                context.state = { known: data.ids };
                resolve();
            }
        );
    });
}

/**
 * Get new followers.
 * @param {Object} auth
 * @param {Object} params
 * @param {Set} knownFollowers
 * @param {Set} newFollowers
 * @return {Promise} newFollowers
 */
function getNewFollowers(auth, params, knownFollowers, newFollowers) {

    return new Promise((resolve, reject) => {
        commons.getTwitterApi(auth).followers(
            'list',
            params,
            auth.accessToken,
            auth.accessTokenSecret,
            (error, data) => {
                if (error) {
                    return reject(error);
                }
                data.users.forEach(user => {
                    if (knownFollowers && !knownFollowers.has(user['id_str'])) {
                        newFollowers.add(user);
                    }
                    knownFollowers.add(user['id_str']);
                });

                return resolve(newFollowers);
            });
    });
}

/**
 * Component triggers when there is a new follower.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        if (!context.state.known) {
            return init(context);
        }

        // set to 200 followers max due to twitter pages, they will return
        // max 200 followers per page, then you would have to use cursors
        // to navigate through the rest
        let params = {
            count: 200
        };
        if (context.properties.screenName) {
            params['screen_name'] = context.properties.screenName;
        }

        let known = new Set(context.state.known);
        let followers = await getNewFollowers(context.auth, params, known, new Set());
        await Promise.map(followers, follower => {
            return context.sendJson(follower, 'out');
        });
        await context.saveState({ known: Array.from(known) });
    }
};

