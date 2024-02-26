'use strict';
const commons = require('../../evernote-commons');

/**
 * Component for creating a tag
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let tag = context.messages.tag.content;
        const client = commons.getEvernoteAPI(context.auth.accessToken).getNoteStore();

        // first, make sure, tag doesn't exist, 'cause if exists, evernote returns an error
        return client.listTags()
            .then(tags => tags ? tags.find(t => t.name === tag.name) : null)
            // if tag already exists, return it, if not, create it
            .then(existingTag => existingTag ?
                existingTag :
                client.createTag({ 'name': tag['name'] }))
            .then(tag => {
                return context.sendJson(tag, 'newTag');
            }).catch(err => {
                throw commons.verboseError(err);
            });
    }
};
