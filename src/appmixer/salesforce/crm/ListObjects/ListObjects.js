/**
 * Component for fetching list of contacts fields.
 * @extends {Component}
 */
const commons = require('../salesforce-commons');

module.exports = {

    async receive(context) {

        const {
            outputType,
            customOnly
        } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return getOutputPortOptions(context, outputType);
        }

        const { data } = await commons.api.salesForceRq(context, {
            action: 'sobjects'
        });

        const sobjects = data.sobjects || [];
        const customSoObjects = customOnly ? sobjects.filter(item => item.custom) : sobjects;

        return commons.sendArrayOutput({
            context,
            outputPortName: 'out',
            outputType,
            records: customSoObjects
        });
    }
};

const getOutputPortOptions = async (context, outputType) => {

    if (outputType === 'object') {

        const output = [
            { label: 'label', value: 'label' },
            { label: 'name', value: 'name' }
        ];

        return context.sendJson(output, 'out');
    } else if (outputType === 'array') {
        return context.sendJson([{ label: 'Result', value: 'result' }], 'out');
    } else {
        // file
        return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
    }
};
