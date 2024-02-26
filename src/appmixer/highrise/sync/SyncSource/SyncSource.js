'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Like other Sync components it has two functions. On start it gets all contacts
 * (people) from Highrise and sends them to it's output port. Then it is a 'tick'
 * component and with every tick it gets newly created or updated contacts (people)
 * form Highrise and sends them to it's output port.
 */
module.exports = {

    /**
     * Get all people form Highrise on start.
     * @param {Context} context
     * @return {Promise.<T>}
     */
    start(context) {

        let { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let getHighriseContacts = Promise.promisify(client.people.get, { context: client.people });

        let started = commons.generateSince();

        return commons.getPeople(getHighriseContacts, [])
            .then(res => {
                res.forEach(contact => {
                    context.sendJson({ phase: 'init', source: 'highrise', data: contact }, 'contact');
                });
                context.state = {
                    since: started        // will be used in tick() method
                };
                context.sendJson({ phase: 'init-done', source: 'highrise' }, 'contact');
            });
    },

    /**
     * With every tick check highrise for newly created or updated contacts (people).
     * @param {Context} context
     */
    tick(context) {

        if (!context.state.since) {
            context.sendError('Tick before SINCE stored in component state.');
            return;
        }

        let { companyId } = context.properties;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let getHighriseContacts = Promise.promisify(client.people.get, { context: client.people });
        let since = commons.generateSince();

        return commons.getPeople(
            getHighriseContacts,
            [],
            { since: context.state.since })
            .then(res => {
                res.forEach(contact => {
                    context.sendJson({
                        phase: 'increment',
                        source: 'highrise',
                        data: contact
                    }, 'contact');
                });

                context.state = {
                    since: since
                };
            });
    }
};
