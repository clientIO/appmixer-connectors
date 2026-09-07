'use strict';

const { apiCall } = require('../../lib');

module.exports = {

    async receive(context) {

        const companyId = parseInt(context.messages.in.content.companyId, 10);

        await apiCall(context, {
            method: 'DELETE',
            url: `/companies/${companyId}`
        });

        return context.sendJson({ companyId }, 'out');
    }
};
