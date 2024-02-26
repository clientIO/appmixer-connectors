'use strict';
const commons = require('../../raynet-commons');
const moment = require('moment');
const Promise = require('bluebird');

let instanceName = '';

/**
 * Process persons to find newly added.
 * @param {Set} knownPersons
 * @param {Array} currentPersons
 * @param {Array} newPersons
 * @param {Object} person
 */
function processPersons(knownPersons, currentPersons, newPersons, person) {

    const arr = [];
    const personId = person['id'] + '';

    if (knownPersons) {
        knownPersons.forEach(known => {
            arr.push(Object.keys(known)[0]);
            if (Object.keys(known)[0] === personId && !known[personId][instanceName]) {
                newPersons.push(person);
            }
        });
        if (arr.indexOf(personId) === -1) {
            newPersons.push(person);
        }
    }

    let obj = {};
    obj[person['id']] = {};
    obj[person['id']][instanceName] = true;
    currentPersons.push(obj);
}

/**
 * Component which triggers whenever new person is added
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        instanceName = context.auth.instanceName;
        let since = moment().format('YYYY-MM-DD HH:mm');

        let res = await commons.getPersons({
            authOptions: context.auth,
            endpoint: 'person',
            method: 'GET',
            instanceName: context.auth.instanceName,
            createdAt: context.state.since || since
        });
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        res.forEach(processPersons.bind(null, known, current, diff));

        await Promise.map(diff, person => {
            return context.sendJson(person, 'person');
        });
        await context.saveState({ known: current, since: since });
    }
};
