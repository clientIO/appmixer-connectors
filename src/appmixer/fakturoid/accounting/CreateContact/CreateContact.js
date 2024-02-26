'use strict';
const fakturoid = require('../../fakturoid-commons');

module.exports = {

    receive(context) {

        let contact = context.messages.contact.content;
        // Unfortunately, Inspector does not allow to have a property "type". Therefore, we use "type_" and do a small
        // conversion here before sending the data to Fakturoid.
        contact.type = contact.type_;
        delete contact.type_;

        return new Promise((resolve, reject) => {
            fakturoid.post('/subjects.json', context.auth, contact, async (err, response, body) => {
                try {
                    if (err) {
                        return reject(err);
                    }
                    if (body && response && response.statusCode === 201) {
                        await context.sendJson(body, 'newContact');
                    } else if (!response || response.statusCode !== 201) {
                        return reject(new Error('Fakturoid post subjects failed with status code ' + (response && response.statusCode)));
                    }
                    resolve();
                } catch (err) {
                    reject(err);
                }
            });
        });
    }
};
