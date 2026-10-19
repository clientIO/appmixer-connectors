'use strict';
const commons = require('../lib');

const CAMPAIGN_FIELDS = ['Id', 'Name', 'IsActive', 'Status', 'Type', 'StartDate', 'EndDate'];

/**
 * Component for fetching list of campaigns
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            if (outputType === 'object') {
                const output = CAMPAIGN_FIELDS.map(field => ({ label: field, value: field }));
                return context.sendJson(output, 'out');
            } else if (outputType === 'file') {
                return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
            }
            // array (default)
            return context.sendJson([{ label: 'Result', value: 'result' }], 'out');
        }

        const isSource = !!(context.properties
            && (context.properties.isSource || context.properties.variableFetch));

        try {
            const campaigns = isSource
                ? await commons.listCampaignsCached(context)
                : await commons.listCampaigns(context);

            return commons.sendArrayOutput({
                context,
                outputPortName: 'out',
                outputType,
                records: campaigns
            });
        } catch (err) {
            if (isSource) {
                // Never break the inspector dropdown on API failures.
                return context.sendJson({ result: [] }, 'out');
            }
            throw err;
        }
    }
};
