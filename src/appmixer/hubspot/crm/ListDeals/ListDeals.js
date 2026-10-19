'use strict';
const Hubspot = require('../../Hubspot');
const ITEM_SCHEMA = require('../../item-schemas.json').deal;

const outputInspector = async (context) => {
    if (context.messages.in.content.allAtOnce) {
        return context.sendJson([{ label: 'Deals', value: 'deals' }], 'out');
    }
    const properties = await context.componentStaticCall(
        'appmixer.hubspot.crm.GetDealsProperties',
        'out',
        {
            transform: './GetDealsProperties#dealToSelectArray'
        }
    );

    let output = [
        {
            label: 'Index',
            value: 'index'
        },
        {
            label: 'Deal object',
            value: 'deal'
        }
    ];

    properties.forEach(property => {
        output.push({
            label: property.label,
            value: `deal.${property.value}`
        });
    });

    return context.sendJson(output, 'out');
};

module.exports = {

    ITEM_SCHEMA,

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return outputInspector(context);
        }

        const {
            allAtOnce,
            limit = 100,
            search,
            pipeline,
            dealstage
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        // Use search API when filtering by pipeline/stage or searching
        const useSearch = search || pipeline || dealstage;

        let params = {};
        if (useSearch) {
            if (search) {
                params.query = search;
            }

            const filters = [];
            if (pipeline) {
                filters.push({
                    propertyName: 'pipeline',
                    operator: 'EQ',
                    value: pipeline
                });
            }
            if (dealstage) {
                filters.push({
                    propertyName: 'dealstage',
                    operator: 'EQ',
                    value: dealstage
                });
            }

            if (filters.length > 0) {
                params.filterGroups = [{ filters }];
            }
        }

        const method = useSearch ? 'post' : 'get';
        const url = useSearch ? 'crm/v3/objects/deals/search' : 'crm/v3/objects/deals';
        const deals = await hs.paginatedCall(method, url, params, limit);

        if (allAtOnce) {
            return context.sendJson({ deals }, 'out');
        }

        let index = 0;
        for (const deal of deals) {
            await context.sendJson({ deal, index }, 'out');
            index++;
        }
    }

};
