'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const lib = require('../../lib');
const { trimUndefined } = require('../../helpers');

// Schema of a single automation item.
const schema = {
    'id': { 'type': 'string', 'title': 'Automation ID', 'example': '7' },
    'name': { 'type': 'string', 'title': 'Name', 'example': 'Welcome series' },
    'status': { 'type': 'string', 'title': 'Status', 'example': '1' },
    'entered': { 'type': 'string', 'title': 'Contacts Entered', 'example': '342' },
    'exited': { 'type': 'string', 'title': 'Contacts Exited', 'example': '310' },
    'cdate': { 'type': 'string', 'format': 'date-time', 'title': 'Created Date', 'example': '2025-01-15T10:30:00-06:00' },
    'mdate': { 'type': 'string', 'format': 'date-time', 'title': 'Modified Date', 'example': '2025-02-20T08:15:00-06:00' }
};

module.exports = {

    async receive(context) {

        const { name, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Automations', value: 'result' });
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const params = trimUndefined({
            'filters[name]': name || undefined
        });

        const automations = await ac.getAutomations(params);

        if (automations.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records: automations });
    }
};
