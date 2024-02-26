'use strict';
const timezones = require('./timezones.json');

module.exports = {

    async receive(context) {

        await context.sendJson({ timezones }, 'out');

    },
    timezonesToSelectArray({ timezones }) {

        return timezones.map(timezone => {
            return { label: timezone.name, value: timezone.timezone };
        });
    }
};

