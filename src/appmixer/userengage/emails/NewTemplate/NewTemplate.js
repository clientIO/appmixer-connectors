'use strict';
const commons = require('../../userengage-commons');
const Promise = require('bluebird');

/**
 * Process templates to find newly added.
 * @param {Set} knownTemplates
 * @param {Array} currentTemplates
 * @param {Array} newTemplates
 * @param {Object} template
 */
function processTemplates(knownTemplates, currentTemplates, newTemplates, template) {

    if (knownTemplates && !knownTemplates.has(template['id'])) {
        newTemplates.push(template);
    }
    currentTemplates.push(template['id']);
}

/**
 * Component which triggers whenever new template is added.
 * @extends {Component}
 */
module.exports = {

    async tick(context) {

        let { apiKey } = context.auth;

        let templates = await commons.getUserengageRequest(apiKey, 'email-templates', 'GET');
        let known = Array.isArray(context.state.known) ? new Set(context.state.known) : null;
        let current = [];
        let diff = [];

        if (templates.results.length) {
            templates.results.forEach(processTemplates.bind(null, known, current, diff));
        }

        await Promise.map(diff, template => {
            return context.sendJson(template, 'template');
        });
        await context.saveState({ known: Array.from(current) });
    },

    async test(context) {

        let { apiKey } = context.auth;

        // Same list endpoint tick() polls; take the freshest template. No state.
        let template = await commons.getLatestResult(apiKey, 'email-templates');
        if (!template) {
            throw new Error('No recent templates to use as test data.');
        }
        return context.sendJson(template, 'template');
    }
};
