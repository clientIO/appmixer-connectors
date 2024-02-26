'use strict';

/**
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        // TODO: In case of Webflow CMS API adds endpoint for forms, refactor this module using those
        const { formName, fields } = context.properties;
        return context.sendJson({ name: formName, fields }, 'out');
    },

    toSelectArray(form) {

        const options = [
            { label: 'Form name', value: 'name' },
            { label: 'Site id', value: 'site' }
        ];
        if (Array.isArray(form.fields)) {
            for (let field of form.fields) {
                options.push({ label: field.name, value: 'data.' + field.name });
            }
        }

        return options;
    }
};

