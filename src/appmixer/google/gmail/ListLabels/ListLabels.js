'use strict';
const commons = require('../gmail-commons');

module.exports = {
    async receive(context) {
        const endpoint = '/users/me/labels';
        const response = await commons.callEndpoint(context, endpoint, {
            headers: { 'Content-Type': 'application/json' }
        });

        // Extract labels from the response data
        const labels = response.data.labels;

        return context.sendJson(labels, 'out');
    },

    labelsToSelectArray(labels) {
        return Array.isArray(labels) ? labels.map(label => ({
            label: label.name,
            value: label.id
        })) : [];
    },

    labelsToSelectArrayFiltered(labels) {
        return Array.isArray(labels) ? labels.reduce((result, label) => {
            if (label.name !== 'SENT' && label.name !== 'DRAFT') {
                result.push({
                    label: label.name,
                    value: label.id
                });
            }
            return result;
        }, []) : [];
    },

    userLabelsToSelectArray(labels) {
        return Array.isArray(labels) ? labels.reduce((result, label) => {
            if (label.type === 'user') {
                result.push({
                    label: label.name,
                    value: label.id
                });
            }
            return result;
        }, []) : [];
    }
};
