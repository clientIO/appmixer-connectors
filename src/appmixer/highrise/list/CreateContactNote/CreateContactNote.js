'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * @param {Object} note
 * @param {String} visibleTo
 * @return {Object}
 */
function buildNote(note, visibleTo) {

    return {
        'body': note['body'],
        'visible_to': visibleTo,
        'subject_id': note['subjectId']
    };
}

/**
 * Component for adding a note to an existing contact.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { companyId, visibleTo } = context.properties;
        let note = context.messages.note.content;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let createContactNote = Promise.promisify(client.notes.create, { context: client.notes });

        return createContactNote(buildNote(note, visibleTo))
            .then(newNote => {
                // just get rid of client object (supprt functions)
                delete newNote.client;
                return context.sendJson(newNote, 'newNote');
            });
    }
};

