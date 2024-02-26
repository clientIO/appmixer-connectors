'use strict';
const commons = require('../../asana-commons');

/**
 * Component for fetching list of teams.
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

        return client.workspaces.findById(workspace)
            .then(res => {
                if (res['is_organization']) {
                    return client.teams.findByOrganization(res.gid)
                        .then(res => {
                            return commons.sendArrayOutput({
                                context,
                                outputPortName: 'teams',
                                outputType,
                                records: res.data
                            });
                        });
                }
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
                'teams'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Teams',
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
                'teams'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'teams');
        }
    }
};
