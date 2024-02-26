'use strict';
const languages = require('./languages.json');

module.exports = {

    async receive(context) {

        await context.sendJson({ languages }, 'out');

    },
    languagesToSelectArray({ languages }) {

        return languages.map(language => {
            return { label: language.name, value: language.code };
        });
    }
};

