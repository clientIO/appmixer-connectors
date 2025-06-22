const lib = require('../../lib.generated');

module.exports = {
    async receive(context) {
        const { outputType } = context.messages.in.content;

        if (context.properties.generateOutputPortOptions) {
            return lib.getOutputPortOptions(context, outputType, schema, { label: 'Campaigns', value: 'result' });
        }

        const queryParams = {
            limit: 100
        };

        let allCampaigns = [];
        let offset = 0;
        let count = 0;
        do {
            // https://developers.brevo.com/reference/getemailcampaigns-1
            const { data } = await context.httpRequest({
                method: 'GET',
                url: 'https://api.brevo.com/v3/emailCampaigns',
                headers: {
                    'api-key': `${context.auth.apiKey}`
                },
                params: { ...queryParams, offset }
            });

            if (offset === 0) {
                count = data.count;
            }

            allCampaigns = allCampaigns.concat(data.campaigns);

            offset += allCampaigns.length;

        } while (count > allCampaigns.length);

        return lib.sendArrayOutput({ context, records: allCampaigns, outputType });
    },

    toSelectArray({ result }) {

        return result.map(campaign => {
            return { label: campaign.name, value: campaign.id };
        });
    }
};

const schema = {
    id: { type: 'integer', title: 'Campaign ID' },
    name: { type: 'string', title: 'Name' },
    type: { type: 'string', title: 'Type' },
    status: { type: 'string', title: 'Status' },
    testSent: { type: 'boolean', title: 'Test Sent' },
    header: { type: 'string', title: 'Header' },
    footer: { type: 'string', title: 'Footer' },
    sender: {
        type: 'object',
        title: 'Sender',
        properties: {
            name: { type: 'string', title: 'Sender.Name' },
            id: { type: 'integer', title: 'Sender.ID' },
            email: { type: 'string', title: 'Sender.Email' }
        }
    },
    replyTo: { type: 'string', title: 'Reply To' },
    toField: { type: 'string', title: 'To Field' },
    previewText: { type: 'string', title: 'Preview Text' },
    tag: { type: 'string', title: 'Tag' },
    inlineImageActivation: { type: 'boolean', title: 'Inline Image Activation' },
    mirrorActive: { type: 'boolean', title: 'Mirror Active' },
    recipients: {
        type: 'object',
        title: 'Recipients',
        properties: {
            lists: {
                type: 'array',
                title: 'Recipients.Lists',
                items: { type: 'integer', title: 'Recipients.Lists' }
            },
            exclusionLists: {
                type: 'array',
                title: 'Recipients.Exclusion Lists',
                items: { type: 'integer', title: 'Recipients.Exclusion Lists' }
            },
            segments: {
                type: 'array',
                title: 'Recipients.Segments',
                items: { type: 'integer', title: 'Recipients.Segments' }
            },
            excludedSegments: {
                type: 'array',
                title: 'Recipients.Excluded Segments',
                items: { type: 'integer', title: 'Recipients.Excluded Segments' }
            }
        }
    },
    statistics: {
        type: 'object',
        title: 'Statistics',
        properties: {
            globalStats: {
                type: 'object',
                title: 'Statistics.Global Stats',
                properties: {
                    uniqueClicks: { type: 'integer', title: 'Statistics.Global Stats.Unique Clicks' },
                    clickers: { type: 'integer', title: 'Statistics.Global Stats.Clickers' },
                    complaints: { type: 'integer', title: 'Statistics.Global Stats.Complaints' },
                    delivered: { type: 'integer', title: 'Statistics.Global Stats.Delivered' },
                    sent: { type: 'integer', title: 'Statistics.Global Stats.Sent' },
                    softBounces: { type: 'integer', title: 'Statistics.Global Stats.Soft Bounces' },
                    hardBounces: { type: 'integer', title: 'Statistics.Global Stats.Hard Bounces' },
                    uniqueViews: { type: 'integer', title: 'Statistics.Global Stats.Unique Views' },
                    unsubscriptions: { type: 'integer', title: 'Statistics.Global Stats.Unsubscriptions' },
                    viewed: { type: 'integer', title: 'Statistics.Global Stats.Viewed' },
                    trackableViews: { type: 'integer', title: 'Statistics.Global Stats.Trackable Views' },
                    trackableViewsRate: { type: 'number', title: 'Statistics.Global Stats.Trackable Views Rate' },
                    estimatedViews: { type: 'integer', title: 'Statistics.Global Stats.Estimated Views' },
                    opensRate: { type: 'number', title: 'Statistics.Global Stats.Opens Rate' },
                    appleMppOpens: { type: 'integer', title: 'Statistics.Global Stats.Apple Mpp Opens' }
                }
            },
            campaignStats: {
                type: 'array',
                title: 'Statistics.Campaign Stats',
                items: { type: 'object', title: 'Statistics.Campaign Stats', properties: {} }
            },
            mirrorClick: { type: 'integer', title: 'Statistics.Mirror Click' },
            remaining: { type: 'integer', title: 'Statistics.Remaining' },
            linksStats: {
                type: 'object',
                title: 'Statistics.Links Stats',
                properties: {}
            },
            statsByDomain: {
                type: 'object',
                title: 'Statistics.Stats By Domain',
                properties: {}
            }
        }
    },
    htmlContent: { type: 'string', title: 'HTML Content' },
    subject: { type: 'string', title: 'Subject' },
    scheduledAt: { type: 'string', title: 'Scheduled At' },
    createdAt: { type: 'string', title: 'Created At' },
    modifiedAt: { type: 'string', title: 'Modified At' },
    shareLink: { type: 'string', title: 'Share Link' },
    sendAtBestTime: { type: 'boolean', title: 'Send At Best Time' },
    abTesting: { type: 'boolean', title: 'Ab Testing' }
};
