'use strict';
const { SlackAPIError } = require('./errors');
const Entities = require('html-entities').AllHtmlEntities;
const axios = require('axios');

class SlackAPI {

    constructor(token) {

        this.token = token;
        this.url = 'https://slack.com/api/';
    }

    /**
     * Used for paginated endpoints/methods. If limit is set to null, it will call the method until
     * all pages are fetched.
     * @param {Function} fetchData
     * @param {Function} dataExtractor
     * @param {Function} cursorExtractor
     * @param {Number} [limit]
     * @return {Promise<*>}
     * @private
     */
    async paginatedCall(fetchData, dataExtractor, cursorExtractor, limit = null) {

        let result = [];
        let cursor = null;

        while (limit === null || result.length < limit) {
            const pageResults = await fetchData(cursor);
            cursor = cursorExtractor(pageResults);
            result = result.concat(dataExtractor(pageResults));
            if (!cursor || cursor === '') {
                break;
            }
        }

        return limit === null ? result : result.slice(0, limit);
    }

    /**
     * List users.
     * @return {Promise<Array<>>}
     */
    async listUsers() {

        const response = await this.makeRequest({
            method: 'GET',
            url: this.url + 'users.list',
            params: { 'presence': 0 }
        });
        return response.members;
    }

    /**
     * Create Slack channel
     * @param {string} name
     * @param {boolean} [privateChannel]
     * @return {Promise<*>}
     */
    async createChannel(name, privateChannel = false) {

        const response = await this.makeRequest({
            method: 'POST' ,
            url: this.url + 'conversations.create',
            json: true,
            data: {
                name,
                'is_private': privateChannel
            }
        });

        return response.channel;
    }

    /**
     * List channels.
     * @param {Object} options
     * @param {Number} [limit] - If is null, means no limit
     * @public
     */
    async listChannels(options, limit = null) {

        const fetchData = (cursor = null) => {
            return this.makeRequest({
                method: 'GET',
                url: this.url + 'conversations.list',
                params: {
                    ...options,
                    ...(cursor ? { cursor } : {})
                }
            });
        };
        const dataExtractor = (pageResults) => (pageResults.channels);
        const cursorExtractor = (pageResults) => (pageResults.response_metadata.next_cursor);
        return this.paginatedCall(fetchData, dataExtractor, cursorExtractor, limit);
    }

    listMessages(channelId, options, limit = null) {

        const fetchData = (cursor = null) => {
            return this.makeRequest({
                method: 'GET',
                url: this.url + 'conversations.history',
                params: {
                    ...options,
                    channel: channelId,
                    ...(cursor ? { cursor } : {})
                }
            });
        };
        const dataExtractor = (pageResults) => (pageResults.messages);
        const cursorExtractor = (pageResults) => {
            if (!pageResults.has_more) {
                return null;
            }
            return pageResults.response_metadata.next_cursor;
        };
        return this.paginatedCall(fetchData, dataExtractor, cursorExtractor, limit);
    }

    /**
     * Send slack channel message.
     * @param {string} channelId
     * @param {string} message
     * @return {Promise<*>}
     */
    async sendMessage(channelId, message) {

        let entities = new Entities();

        const response = await this.makeRequest({
            method: 'POST',
            url: this.url + 'chat.postMessage',
            data: {
                'channel': channelId,
                'text': entities.decode(message),
                'as_user': true
            }
        });

        return response.message;
    }

    async updateMessage(channel, text, ts) {

        let entities = new Entities();

        const response = await this.makeRequest({
            method: 'POST',
            url: this.url + 'chat.update',
            data: {
                channel,
                text: entities.decode(text),
                ts
            }
        });

        const data = {
            ok: response.ok,
            channel: response.channel,
            ts: response.ts,
            text: response.message.text,
            user: response.message.user
        };

        return data;
    }

    async deleteMessage(channel, ts) {

        const response = await this.makeRequest({
            method: 'POST',
            url: this.url + 'chat.delete',
            data: {
                channel,
                ts
            }
        });

        return response;
    }

    /**
     * Make HTTP request.
     * @param {Object} options
     * @return {Promise<*>}
     * @protected
     */
    async makeRequest(options) {

        const response = await axios(
            Object.assign(options, {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            })
        );

        if (!response.data) {
            throw new SlackAPIError(response.statusText);
        }

        if (!response.data.ok) {
            throw new SlackAPIError(response.data.error);
        }

        return response.data;
    }
}

module.exports = {

    /**
     * Get new SlackAPI client.
     * @param {string} token
     * @returns {SlackAPI}
     */
    getSlackAPIClient(token) {

        return new SlackAPI(token);
    }
};
