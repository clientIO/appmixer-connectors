'use strict';
const { sendArrayOutput } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'trackingCategories';

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, outputType, ...params } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        const xc = new XeroClient(context, tenantId);
        const records = await xc.requestPaginated('GET', '/api.xro/2.0/TrackingCategories', { params });

        return sendArrayOutput({
            context,
            outputPortName,
            outputType,
            records
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    { label: 'Name', value: 'Name' },
                    { label: 'Status', value: 'Status' },
                    { label: 'Tracking Category ID', value: 'TrackingCategoryID' },
                    {
                        label: 'Options', value: 'Options', schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    TrackingOptionID: { type: 'string', title: 'TrackingOptionID' },
                                    Name: { type: 'string', title: 'Name' },
                                    Status: { type: 'string', title: 'Status' },
                                    HasValidationErrors: { type: 'boolean', title: 'HasValidationErrors' },
                                    IsDeleted: { type: 'boolean', title: 'IsDeleted' },
                                    IsArchived: { type: 'boolean', title: 'IsArchived' },
                                    IsActive: { type: 'boolean', title: 'IsActive' }
                                }
                            }
                        }
                    }
                ],
                outputPortName
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Tracking Categories',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    Name: { type: 'string', title: 'Name' },
                                    Status: { type: 'string', title: 'Status' },
                                    TrackingCategoryID: { type: 'string', title: 'Tracking Category ID' },
                                    Options: {
                                        title: 'Options',
                                        schema: {
                                            type: 'array',
                                            items: {
                                                type: 'object',
                                                properties: {
                                                    TrackingOptionID: { type: 'string', title: 'TrackingOptionID' },
                                                    Name: { type: 'string', title: 'Name' },
                                                    Status: { type: 'string', title: 'Status' },
                                                    HasValidationErrors: { type: 'boolean', title: 'HasValidationErrors' },
                                                    IsDeleted: { type: 'boolean', title: 'IsDeleted' },
                                                    IsArchived: { type: 'boolean', title: 'IsArchived' },
                                                    IsActive: { type: 'boolean', title: 'IsActive' }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                ],
                outputPortName
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], outputPortName);
        }
    }
};
