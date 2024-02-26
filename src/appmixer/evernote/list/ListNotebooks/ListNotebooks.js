'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for fetching a notebooks
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();
        return client.listNotebooks()
            .then(res => {
                return context.sendJson(res, 'notebooks');
            });
    }
};

