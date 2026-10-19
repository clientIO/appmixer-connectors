'use strict';
const { sendArrayOutput, withCache, getOutputPortOptions } = require('../../commons');
const XeroClient = require('../../XeroClient');

const outputPortName = 'trackingCategories';

const ITEM_SCHEMA = {
    type: 'object',
    required: ['TrackingCategoryID', 'Name', 'Status'],
    properties: {
        Name: { type: 'string', title: 'Name', example: 'Region' },
        Status: { type: 'string', title: 'Status', example: 'ACTIVE' },
        TrackingCategoryID: {
            type: 'string',
            title: 'Tracking Category ID',
            example: 'c1f7a4d2-8b39-4e05-9d6a-1f2b3c4d5e60'
        },
        Options: {
            type: 'array',
            title: 'Options',
            example: [
                {
                    TrackingOptionID: '8e4b1c06-3d72-4a95-b8f1-0c2d5e7a9b34',
                    Name: 'North',
                    Status: 'ACTIVE',
                    HasValidationErrors: false,
                    IsDeleted: false,
                    IsArchived: false,
                    IsActive: true
                }
            ],
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
};

module.exports = {

    ITEM_SCHEMA,

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

        return getOutputPortOptions(context, outputType, ITEM_SCHEMA.properties, {
            label: 'Tracking Categories',
            outputPortName
        });
    }
};
