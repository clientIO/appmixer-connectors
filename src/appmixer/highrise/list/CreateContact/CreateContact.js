'use strict';
const commons = require('../../highrise-commons');
const Promise = require('bluebird');

/**
 * Build person data.
 * @param {Object} person
 * @param {string} visibleTo
 * @return {Object} personObject
 */
function buildPerson(person, visibleTo) {

    let personObject = {
        'first_name': person['firstName'],
        'last_name': person['lastName'],
        'visible_to': visibleTo,
        'contact_data': {}
    };

    personObject['title'] = person['title'] ? person['title'] : undefined;
    personObject['company_name'] = person['companyName'] ? person['companyName'] : undefined;
    personObject['linkedin_url'] = person['linkedIn'] ? person['linkedIn'] : undefined;
    personObject['background'] = person['background'] ? person['background'] : undefined;

    if (person['email']) {
        personObject['contact_data']['email_addresses'] = {
            'email_address': {
                'address': person['email'],
                'location': person['emailLocation']
            }
        };
    }
    if (person['phone']) {
        personObject['contact_data']['phone_numbers'] = {
            'phone_number': {
                'number': person['phone'],
                'location': person['phoneLocation']
            }
        };
    }
    if (person['imAddress']) {
        personObject['contact_data']['instant_messengers'] = {
            'instant_messenger': {
                'address': person['imAddress'],
                'protocol': person['imProtocol'],
                'location': person['imLocation']
            }
        };
    }
    if (person['twitter']) {
        personObject['contact_data']['twitter_accounts'] = {
            'twitter_account': {
                'username': person['twitter']
            }
        };
    }
    if (person['web']) {
        personObject['contact_data']['web_addresses'] = {
            'web_address': {
                'url': person['web'],
                'location': person['webLocation']
            }
        };
    }

    return personObject;
}

/**
 * Tag person record.
 * @param client
 * @param {string} personId
 * @param {string} tag
 * @return Promise
 */
function tagPerson(client, personId, tag) {

    // Tag and Tags classes are available from github master branch
    // https://github.com/florianholzapfel/node-highrise-api/tree/master
    let createTag = Promise.promisify(client.tag.create, { context: client.tag });

    return createTag({
        'subject_type': 'people',
        'subject_id': personId,
        'name': tag
    });
}

/**
 * Component for contact creation or update on highrise.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        let { companyId, visibleTo } = context.properties;
        let person = context.messages.contact.content;
        const options = { userAgent: context.auth.userAgent };
        let client = commons.getHighriseAPI(companyId, context.auth.accessToken, options);
        let findPeople = Promise.promisify(client.people.find, { context: client.people });

        return findPeople({
            'email': person['email']
        }).then(foundPeople => {

            let personRequest = buildPerson(person, visibleTo);
            // update already created contact
            if (foundPeople.length) {
                let promises = [];

                foundPeople.forEach(foundPerson => {

                    let updatePerson = Promise.promisify(foundPerson.update, { context: foundPerson });
                    delete personRequest['contact_data'];
                    Object.assign(foundPerson, personRequest);
                    promises.push(updatePerson().then(() => foundPerson));
                });

                return Promise.all(promises);
            } else { // create new contact
                let createPerson = Promise.promisify(client.person.create, { context: client.person });
                return createPerson(personRequest);
            }
        }).then(people => {
            // process tags
            people = Array.isArray(people) ? people : [people];
            if (person['tag']) {
                let promises = [];
                people.forEach(createdPerson => {
                    let createdPersonId = createdPerson['id'] || createdPerson['req']['path'].match(/\d+/)[0];
                    let tags = person['tag'].split(',');
                    tags.forEach(tag => {
                        tag = tag.trim();
                        if (tag) {
                            promises.push(tagPerson(client, createdPersonId, tag)
                                .then(() => createdPerson));
                        }
                    });
                });
                return Promise.all(promises);
            } else {
                return Promise.resolve(people);
            }
        }).then(contacts => {
            return Promise.map(contacts, contact => {
                delete contact.client;
                return context.sendJson(contact, 'newContact');
            });
        });
    }
};

