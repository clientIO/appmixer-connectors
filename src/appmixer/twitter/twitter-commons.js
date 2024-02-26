'use strict';
const TwitterApi = require('node-twitter-api');
const Promise = require('bluebird');

module.exports = {

    getTwitterApi(auth) {

        return Promise.promisifyAll(new TwitterApi({
            consumerKey: auth.consumerKey,
            consumerSecret: auth.secretKey,
            callback: auth.callback
        }));
    },

    /**
     * Twitter API cannot handle ! and other characters.
     * @param {string} str
     * @return {string}
     */
    escape(str) {

        return encodeURIComponent(str).replace(/[!*()']/g, function(character) {
            return '%' + character.charCodeAt(0).toString(16);
        });
    }
};
