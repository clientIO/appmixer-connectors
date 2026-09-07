'use strict';
const ActiveCampaign = require('../../ActiveCampaign');
const lib = require('../../lib');
const { trimUndefined } = require('../../helpers');

// Schema of a single deal item.
const schema = {
    'id': { 'type': 'string', 'title': 'Deal ID', 'example': '5' },
    'title': { 'type': 'string', 'title': 'Title', 'example': 'Enterprise plan' },
    'description': { 'type': 'string', 'title': 'Description', 'example': 'Annual subscription upgrade.' },
    'contact': { 'type': 'string', 'title': 'Contact ID', 'example': '1001' },
    'owner': { 'type': 'string', 'title': 'Owner ID', 'example': '3' },
    'group': { 'type': 'string', 'title': 'Pipeline ID', 'example': '1' },
    'stage': { 'type': 'string', 'title': 'Stage ID', 'example': '2' },
    'status': { 'type': 'string', 'title': 'Status', 'example': '0' },
    'value': { 'type': 'string', 'title': 'Deal Amount (cents)', 'example': '45000' },
    'currency': { 'type': 'string', 'title': 'Currency', 'example': 'usd' },
    'cdate': { 'type': 'string', 'format': 'date-time', 'title': 'Created Date', 'example': '2025-01-15T10:30:00-06:00' },
    'mdate': { 'type': 'string', 'format': 'date-time', 'title': 'Modified Date', 'example': '2025-02-20T08:15:00-06:00' }
};

module.exports = {

    async receive(context) {

        const { search, stage, status, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Deals', value: 'result' });
        }

        const { auth } = context;
        const ac = new ActiveCampaign(auth.url, auth.apiKey, context);

        const params = trimUndefined({
            limit: ActiveCampaign.MAX_RECORDS_PER_PAGE,
            search: search || undefined,
            stage: stage || undefined,
            status: status || undefined
        });

        const deals = await ac.getDeals(params, ActiveCampaign.MAX_RECORDS_PER_PAGE);

        if (deals.length === 0) {
            return context.sendJson({}, 'notFound');
        }

        return lib.sendArrayOutput({ context, outputType, records: deals });
    }
};
