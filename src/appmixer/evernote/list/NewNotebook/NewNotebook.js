'use strict';
const commons = require('../../evernote-commons');
const Promise = require('bluebird');

/**
 * Process notebooks to find newly added.
 * @param {Set} knownNotebooks
 * @param {Set} actualNotebooks
 * @param {Set} newNotebooks
 * @param {Object} notebook
 */
function processNotebooks(knownNotebooks, actualNotebooks, newNotebooks, notebook) {

    if (knownNotebooks && !knownNotebooks.has(notebook['guid'])) {
        newNotebooks.add(notebook);
    }
    actualNotebooks.add(notebook['guid']);
}

/**
 * Component which triggers whenever new notebook is added
 * @extends {Component}
 */
module.exports = {

    tick(context) {

        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();

        return client.listNotebooks()
            .then(res => {
                let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
                let actual = new Set();
                let diff = new Set();

                res.forEach(processNotebooks.bind(null, known, actual, diff));

                if (diff.size) {
                    return Promise.map(diff, notebook => {
                        return context.sendJson(notebook, 'notebook');
                    });
                }
            })
            .then(() => {
                return context.saveState({ known: Array.from(actual) });
            })
            .catch(err => {
                throw commons.verboseError(err);
            });
    },

    /**
     * Flow Test Mode: emit the newest notebook without starting the flow. Reuses the same
     * listNotebooks() source tick() reads from (via commons), emitting the notebook object
     * in the identical shape tick() sends.
     */
    test(context) {

        return commons.fetchLatestNotebook(context)
            .then(notebook => {
                if (!notebook) {
                    throw new Error('No notebooks to use as test data.');
                }
                return context.sendJson(notebook, 'notebook');
            })
            .catch(err => {
                throw commons.verboseError(err);
            });
    }
};

