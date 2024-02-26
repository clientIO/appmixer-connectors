'use strict';

/**
 * Transformer for templates in userengage
 * @param {Object|string} templates
 */
module.exports.templatesToSelectArray = templates => {

    let transformed = [];

    if (Array.isArray(templates)) {
        templates.forEach(template => {

            transformed.push({
                label: template['name'],
                value: template['id']
            });
        });
    }

    return transformed;
};
