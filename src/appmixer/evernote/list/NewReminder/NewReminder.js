'use strict';
const commons = require('../../evernote-commons');
const Promise = require('bluebird');

/**
 * Process reminders to find newly added.
 * @param {Number} startedTime - used for the first time to check which notes are new
 * @param {Set} knownReminders
 * @param {Set} actualReminders
 * @param {Set} newReminders
 * @param {Object} reminder
 */
function processReminders(startedTime, knownReminders, actualReminders, newReminders, reminder) {

    let arr = [];
    if (knownReminders) {
        knownReminders.forEach(known => {
            arr.push(Object.keys(known)[0]);
            if (Object.keys(known)[0] === reminder['guid']
                && known[reminder['guid']] !== reminder['attributes']['reminderOrder']
                && reminder['attributes']['reminderOrder']) {

                newReminders.add(reminder);
            }
        });

        if (arr.indexOf(reminder['guid']) === -1 && reminder['attributes']['reminderOrder']) {
            newReminders.add(reminder);
        }
    } else if (!knownReminders && reminder['attributes']['reminderOrder'] > startedTime) {
        newReminders.add(reminder);
    }

    let obj = {};
    obj[reminder['guid']] = reminder['attributes']['reminderOrder'];
    actualReminders.add(obj);
}

/**
 * Component which triggers whenever new reminder is added
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();
        let newState = Object.assign({}, context.state);

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
                return client.findNotesMetadata({}, 0, 1000, { includeAttributes: true });
            })
            .then(res => {
                if (res === null) {
                    return [];
                }

                let promises = [];
                res['notes'].forEach(note => {
                    promises.push(client.getNoteWithResultSpec(note['guid'], {}));
                });
                return Promise.all(promises);
            })
            .then(notes => {
                if (notes.length) {
                    let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                    let actual = new Set();
                    let diff = new Set();

                    notes.forEach(processReminders.bind(null, context.state.startedTime, known, actual, diff));
                    newState.known = Array.from(actual);

                    if (diff.size) {
                        return Promise.map(diff, note => {
                            note['attributes'] = commons.formatFields(
                                note['attributes'],
                                ['reminderTime', 'reminderDoneTime'],
                                commons.formatDate);
                            return context.sendJson(note, 'reminder');
                        });
                    }
                }
            })
            .then(() => {
                return context.saveState(newState);
            })
            .catch(err => {
                throw commons.verboseError(err);
            });
    }
};

