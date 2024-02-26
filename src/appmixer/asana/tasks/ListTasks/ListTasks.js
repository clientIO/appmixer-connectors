'use strict';
const commons = require('../../asana-commons');

/**
 * Component for fetching list of tasks
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { project, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        let client = commons.getAsanaAPI(context.auth.accessToken);

        return client.projects.tasks(project)
            .then(res => {
                return commons.sendArrayOutput({
                    context,
                    outputPortName: 'tasks',
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
                    { label: 'Resource type', value: 'resource_type' },
                    { label: 'Resource sub type', value: 'resource_subtype' }
                ],
                'tasks'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Tasks',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    'gid': { title: 'gid', type: 'string' },
                                    'name': { title: 'Name', type: 'string' },
                                    'resource_type': { title: 'Resource type', type: 'string' },
                                    'resource_subtype': { title: 'Resource sub type', type: 'string' }
                                }
                            }
                        }
                    }
                ],
                'tasks'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'tasks');
        }
    }
};
