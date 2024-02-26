'use strict';
const commons = require('../../evernote-commons');
const Promise = require('bluebird');

/**
 * Process notes to find newly added.
 * @param {Number} startedTime - used for the first time to check which notes are new
 * @param {Set} knownNotes
 * @param {Set} actualNotes
 * @param {Set} newNotes
 * @param {Object} note
 */
function processNotes(startedTime, knownNotes, actualNotes, newNotes, note) {

    if (knownNotes && !knownNotes.has(note['guid'])) {
        newNotes.add(note);
    } else if (!knownNotes && note['created'] > startedTime) {
        newNotes.add(note);
    }
    actualNotes.add(note['guid']);
}

/**
 * Component which triggers whenever new note is added.
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();
        let newState = Object.assign({}, context.state);

        // findNotesMetada is expensive, we should call it more than once in 15 minutes
        // according to Evernote doc, otherwise our API key could be blocked. Therefore
        // getSyncState is used to check whether there are new changes
        return client.getSyncState()
            .then(syncState => {
                newState.lastUpdateCount = syncState.updateCount;
                // called for the first time, let's just save the updateCount
                if (!context.state.lastUpdateCount) {
                    newState.startedTime = syncState.currentTime;
                    return null;
                }

                if (syncState.updateCount <= context.state.lastUpdateCount) {
                    return null;
                }

                return client.findNotesMetadata({ ascending: false }, 0, 1000, { includeCreated: true });
            })
            .then(res => {
                if (res === null) {
                    return [];
                }

                let promises = [];
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res['notes'].forEach(processNotes.bind(null, context.state.startedTime, known, actual, diff));
                newState.known = Array.from(actual);

                if (diff.size) {
                    diff.forEach(note => {
                        promises.push(client.getNoteWithResultSpec(note['guid'], { includeContent: true }));
                    });
                }
                return Promise.all(promises);
            })
            .then(data => {
                if (data.length) {
                    return Promise.map(data, note => {
                        note['attributes'] = commons.formatFields(
                            note['attributes'],
                            ['reminderTime', 'reminderDoneTime'],
                            commons.formatDate);
                        return context.sendJson(note, 'note');
                    }).then(() => {
                        return context.saveState(newState);
                    });
                }
                return context.saveState(newState);
            })
            .catch(err => {
                throw commons.verboseError(err);
            });
    }
};
