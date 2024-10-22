module.exports = {

    async sendArrayOutput({ context, outputPortName = 'out', outputType = 'array', records = [] }) {
        if (outputType === 'first') {
            // One by one.
            await context.sendJson(records[0], outputPortName);
        } else if (outputType === 'object') {
            // One by one.
            await context.sendArray(records, outputPortName);
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || 'wiz-objects-export'}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .map(field => {
                    const schema = itemSchema[field];
                    const label = schema.title;
                    delete schema.title;

                    return {
                        label, value: field, schema
                    };
                });
            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label: 'Resources',
                value: 'result',
                schema: {
                    type: 'array',
                    items: { type: 'object', properties: itemSchema }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    },

    async makeApiCall({ context, method = 'GET', data }) {

        const url = context.config.apiEndpointUrl || 'https://api.eu4.app.wiz.io/graphql';

        context.log({ stage: 'API URL', url });

        return context.httpRequest({
            method,
            url,
            headers: {
                'content-type': 'application/json',
                'authorization': `Bearer ${context.auth.token}`
            },
            data
        });
    }
};

/**
 * @param {array} array
 * @returns {string}
 */
const toCsv = (array) => {
    const headers = Object.keys(array[0]);

    return [
        headers.join(','),

        ...array.map(items => {
            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })

    ].join('\n');
};
