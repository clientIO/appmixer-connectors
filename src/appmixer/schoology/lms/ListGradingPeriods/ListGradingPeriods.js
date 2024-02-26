'use strict';
const { createClientFromContext } = require('../../sdk');

module.exports = {

    async receive(context) {

        const client = createClientFromContext(context);
        const data = await client.apiRequest('get', '/gradingperiods');

        return context.sendJson({ gradingPeriods: data.gradingperiods }, 'out');
    },

    toSelectArray({ gradingPeriods }) {

        return gradingPeriods.map(item => ({ label: `${item.title} (${item.start} - ${item.end})`, value: item.id }));
    }
};
