'use strict';

/**
 * Transformer for templates in mandrill.
 * @param {Object|string} templates
 */
module.exports.templatesToSelectArray = templates => {

    let transformed = [];

    if (Array.isArray(templates)) {
        templates.forEach(template => {

            transformed.push({
                label: template['name'],
                value: template['name']
            });
        });
    }

    return transformed;
};
