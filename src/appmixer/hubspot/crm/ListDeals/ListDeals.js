'use strict';
const Hubspot = require('../../Hubspot');

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

    async receive(context) {

        if (context.properties.generateOutputPortOptions) {
            return outputInspector(context);
        }

        const {
            allAtOnce,
            limit = 100,
            search
        } = context.messages.in.content;

        const { auth } = context;
        const hs = new Hubspot(auth.accessToken, context.config);

        let params = {};
        if (search) {
            params.query = search;
        }

        const method = params.query ? 'post' : 'get';
        const url = params.query ? 'crm/v3/objects/deals/search' : 'crm/v3/objects/deals';
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
