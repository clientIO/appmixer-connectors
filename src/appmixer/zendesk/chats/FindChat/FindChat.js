'use strict';
const Promise = require('bluebird');
const commons = require('../../zendesk-commons');

function formatQuery(queryString, field, value) {

    if (queryString) {
        queryString += ` AND ${field}:${value}`;
    } else {
        queryString = `${field}:${value}`;
    }

    return queryString;
}

function buildQueryString(queryParams) {

    const { query, agentName, visitorName, visitorEmail, timestamp, endTimestamp, type, rating } = queryParams;

    let queryString;
    if (query) {
        queryString = query;
    }

    if (agentName) {
        queryString = formatQuery(queryString, 'agent_names', agentName);
    }

    if (visitorName) {
        queryString = formatQuery(queryString, 'visitor_name', visitorName);
    }

    if (visitorEmail) {
        queryString = formatQuery(queryString, 'visitor_email', visitorEmail);
    }

    if (timestamp && endTimestamp) {
        queryString = formatQuery(queryString, 'timestamp', `[${timestamp} TO ${endTimestamp}]`);
    } else if (timestamp) {
        queryString = formatQuery(queryString, 'timestamp', `[${timestamp} *]`);
    } else if (endTimestamp) {
        queryString = formatQuery(queryString, 'end_timestamp', `[${endTimestamp} *]`);
    }

    if (type && type !== 'all') {
        queryString = formatQuery(queryString, 'type', type);
    }

    if (rating && rating !== 'all') {
        queryString = formatQuery(queryString, 'rating', rating);
    }

    return queryString;
}

/**
 * Find chats.
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const queryParams = context.messages.in.content;
        const sendWholeArray = queryParams.sendWholeArray;

        const response = await commons.get(`chats/search?q=${buildQueryString(queryParams)}`, context.auth);
        const { results } = response;
        const promises = [];

        results.forEach(result => promises.push(commons.get(`chats/${result.id}`, context.auth)));

        const chats = await Promise.all(promises);

        if (sendWholeArray) {
            return context.sendJson(chats, 'chat');
        }

        return Promise.map(chats, chat => {
            return context.sendJson(chat, 'chat');
        });
    }
};
