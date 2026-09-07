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
                        commons.formatNoteAttributes(note);
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
    },

    /**
     * Flow Test Mode: emit the newest note without starting the flow or waiting for a
     * new one. Shares the fetch + attribute-formatting path with tick() via commons,
     * skipping the sync-state baseline so the first/only fetch returns a real note.
     */
    test(context) {

        return commons.fetchLatestNote(context)
            .then(note => {
                if (!note) {
                    throw new Error('No recent notes to use as test data.');
                }
                return context.sendJson(note, 'note');
            })
            .catch(err => {
                throw commons.verboseError(err);
            });
    }
};
