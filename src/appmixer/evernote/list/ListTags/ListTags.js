'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for fetching tags
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();
        return client.listTags()
            .then(res => {
                return context.sendJson(res, 'tags');
            });
    }
};

