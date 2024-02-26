'use strict';
const GoogleApi = require('googleapis');
const commons = require('../../google-commons');
const Promise = require('bluebird');

// GoogleApi initialization & promisify of some api function for convenience
const calendar = GoogleApi.calendar('v3');
const insertEvent = Promise.promisify(calendar.events.insert, { context: calendar.events });

function isDate(param) {

    return param.match('^[0-9]{4}-[0|1][0-9]-[0-3][0-9]$');
}

/**
 * @param {Object} inputJson
 * @return {Object}
 */
function buildEvent(inputJson) {

    let start = isDate(inputJson.start) ?
        { date: inputJson.start } : { dateTime: inputJson.start };
    let end = isDate(inputJson.end) ?
        { date: inputJson.end } : { dateTime: inputJson.end };

    return {
        'summary': inputJson.summary,
        'start': start,
        'end': end,
        'description': inputJson.description,
        'location': inputJson.location
    };
}

/**
 * Component for event creation on google calendar.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        return insertEvent({
            auth: commons.getOauth2Client(context.auth),
            userId: 'me',
            quotaUser: context.auth.userId,
            calendarId: encodeURIComponent(context.messages.in.content.calendarId),
            resource: buildEvent(context.messages.in.content)
        }).then(result => {
            result.start = commons.formatDate(result.start);
            result.end = commons.formatDate(result.end);
            return context.sendJson(
                Object.assign(
                    { calendarId: context.messages.in.content.calendarId },
                    result),
                'event');
        });
    }
};
