'use strict';
const { XMLValidator } = require('fast-xml-parser');

module.exports = {

    async receive(context) {

        const {
            xml,
            allowBooleanAttributes,
            unpairedTags
        } = context.messages.in.content;

        const options = {
            allowBooleanAttributes,
            unpairedTags: (unpairedTags || '').split(',').map(tag => tag.trim())
        };

        const result = XMLValidator.validate(xml, options);
        const isValid = result === true;
        const err = isValid ? {} : result.err;
        return context.sendJson({ isValid, err }, 'out');
    }
};
