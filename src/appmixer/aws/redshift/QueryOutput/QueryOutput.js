'use strict';

module.exports = {

    async receive(context) {

        const { outputType } = context.properties;

        const options = {
            'object': [{ label: 'Result', value: 'result' }, { label: 'Metadata', value: 'metadata' }],
            'array': [{ label: 'Result', value: 'result' }, { label: 'Metadata', value: 'metadata' }],
            'file': [{ label: 'File ID', value: 'fileId' }, { label: 'Metadata', value: 'metadata' }]
        };
        return context.sendJson(options[outputType] || [], 'out');
    }
};
