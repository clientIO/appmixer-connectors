'use strict';
const { sendArrayOutput, withCache } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'trackingCategories';

module.exports = {

    async receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { tenantId, outputType, ...params } = context.messages.in.content;
        const isSource = context.properties.isSource;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        // tenantId is intentionally not a hard schema requirement so this list can back a dependent
        // dropdown (e.g. CreateTrackingCategoryOption's Tracking Category select). When called as a
        // dropdown source (isSource), degrade gracefully to an empty list on ANY problem — a missing
        // tenantId (still an unresolved variable at design time), an invalid tenantId, or a failed
        // API call — so the inspector shows no options instead of an error popup and the user can
        // type the value. Real flow runs must fail loudly, so only suppress when isSource is set.
        if (!tenantId) {
            if (isSource) {
                return context.sendJson({ items: [] }, outputPortName);
            }
            throw new context.CancelError('Tenant ID is required!');
        }

        try {
            // Cache the assembled tracking categories array so repeated inspector source calls reuse one fetch.
            const records = await withCache(
                context,
                { tenantId, url: '/api.xro/2.0/TrackingCategories', params },
                () => new XeroClient(context, tenantId)
                    .requestPaginated('GET', '/api.xro/2.0/TrackingCategories', { params })
            );

            return sendArrayOutput({
                context,
                outputPortName,
                outputType,
                records
            });
        } catch (err) {
            if (isSource) {
                return context.sendJson({ items: [] }, outputPortName);
            }
            throw err;
        }
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
                                                    HasValidationErrors: {
                                                        type: 'boolean',
                                                        title: 'HasValidationErrors'
                                                    },
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
