'use strict';
const Hubspot = require('../../Hubspot');

module.exports = {
    async receive(context) {

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        // https://developers.hubspot.com/docs/reference/api/automation/workflows/v3
        const { data } = await hs.call('get', 'automation/v3/workflows', {});
        const workflows = (data && data.workflows) ? data.workflows : [];

        return context.sendJson({ workflows }, 'out');
    },

    workflowsToSelectArray({ workflows }) {

        if (!Array.isArray(workflows)) {
            return [];
        }
        return workflows.map(wf => ({
            label: wf.name || String(wf.id),
            value: String(wf.id)
        }));
    }
};
