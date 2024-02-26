const commons = require('../salesforce-commons');

module.exports = {

    async receive(context) {

        const { query, outputType } = context.messages.in.content;

        if (context.properties.generateInspector) {
            return getOutputPortOptions(context);
        }

        const params = {
            q: query
        };

        const { data } = await commons.api.salesForceRq(context, {
            action: `query?${new URLSearchParams(params).toString()}`
        });

        if (data.records && data.records.length) {
            return commons.sendArrayOutput({
                context,
                outputPortName: 'out',
                outputType,
                records: data.records
            });
        } else {

            // no records found
            /* example
            {
                "totalSize": 0,
                "done": true,
                "records": []
              }
             */
            await context.log({ stage: 'Empty result response', response: data });
            return context.sendJson(data, 'emptyResult');
        }
    }
};

const getOutputPortOptions = async (context, outputType) => {

    if (outputType === 'object') {
        return context.sendJson([{}], 'out');
    } else if (outputType === 'array') {
        return context.sendJson([{ label: 'Result', value: 'result' }], 'out');
    } else {
        // file
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
};

