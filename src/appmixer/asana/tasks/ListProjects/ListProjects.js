'use strict';
const commons = require('../../asana-commons');

/**
 * Component for fetching list of projects
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { workspace, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        let client = commons.getAsanaAPI(context.auth.accessToken);

        return client.projects.findAll({ workspace: workspace })
            .then(res => {
                return commons.sendArrayOutput({
                    context,
                    outputPortName: 'projects',
                    outputType,
                    records: res.data
                });
            });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'gid', value: 'gid' },
                    { label: 'Name', value: 'name' },
                    { label: 'Resource type', value: 'resource_type' }
                ],
                'projects'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Projects',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'gid': { title: 'gid', type: 'string' },
                                    'name': { title: 'Name', type: 'string' },
                                    'resource_type': { title: 'Resource type', type: 'string' }
                                }
                            }
                        }
                    }
                ],
                'projects'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'projects');
        }
    }
};
