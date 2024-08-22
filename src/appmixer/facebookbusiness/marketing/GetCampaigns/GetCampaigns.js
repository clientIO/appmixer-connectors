module.exports = {

    async receive(context) {

        const { accountId, outputType = 'array' } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const accessToken = context.auth.accessToken;

        const fields = Object.keys(this.fields);
        const { data } = await context.httpRequest({
            headers: { 'Content-Type': 'application/json' },
            url: `https://graph.facebook.com/v20.0/act_${accountId}/campaigns?access_token=${accessToken}&fields=${fields.join(',')}`
        });

        if (outputType === 'first') {
            return context.sendJson(data.data[0], 'out');
        } else if (outputType === 'object') {
            return context.sendArray(data.data, 'out');
        } else if (outputType === 'array') {
            return context.sendJson({ campaigns: data.data }, 'out');
        } else if (outputType === 'file') {
            // Stored into CSV file.
            const headers = Object.keys(data.data[0] || {});
            let csvRows = [];
            csvRows.push(headers.join(','));
            for (const record of data.data) {
                const values = headers.map(header => {
                    const val = record[header];
                    return `"${val}"`;
                });
                csvRows.push(values.join(','));
            }
            const csvString = csvRows.join('\n');
            let buffer = Buffer.from(csvString, 'utf8');
            const fileName = `facebookbusiness-marketing-GetCampaigns-${(new Date).toISOString()}.csv`;
            const savedFile = await context.saveFileStream(fileName, buffer);
            await context.sendJson({ fileId: savedFile.fileId }, 'out');
        }
    },

    fields: {
        id: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string' },
        adlabels: { type: 'array', items: { type: 'object', properties: {
            id: { type: 'string' },
            name: { type: 'string' }
        } } },
        bid_strategy: { type: 'string' },
        budget_schedule_specs: { type: 'array', items: { type: 'object', properties: {
            time_start: { type: 'string', format: 'datetime' },
            time_end: { type: 'string', format: 'datetime' },
            budget_value: { type: 'number' },
            budget_value_type: { type: 'string' }
        } } },
        buying_type: { type: 'string' },
        daily_budget: { type: 'number' },
        execution_options: { type: 'array', items: { type: 'string' } },
        is_skadnetwork_attribution: { type: 'boolean' },
        iterative_split_test_configs: { type: 'array', items: { type: 'object' } },
        lifetime_budget: { type: 'number' },
        objective: { type: 'string' },
        promoted_object: { type: 'object' },
        source_campaign_id: { type: 'string' },
        special_ad_categories: { type: 'array', items: { type: 'string' } },
        special_ad_category_country: { type: 'array', items: { type: 'string' } },
        spend_cap: { type: 'number' },
        start_time: { type: 'string', format: 'datetime' },
        stop_time: { type: 'string', format: 'datetime' },
        topline_id: { type: 'string' }

    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(this.fields).map(field => {
                let label = field.split('_').join(' ');
                label = label.charAt(0).toUpperCase() + label.slice(1);
                return { label: label, value: field, schema: this.fields[field] };
            });
            return context.sendJson(options, 'out');
        } else if (outputType === 'array') {
            return context.sendJson([{
                label: 'Campaigns',
                value: 'campaigns',
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: this.fields }
                }
            }], 'out');
        } else if (outputType === 'file') {
            return context.sendJson([
                { label: 'File ID', value: 'fileId' }
            ], 'out');
        }
    }
};
