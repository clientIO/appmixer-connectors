const pathModule = require('path');

const BASE_URL = 'https://{{dc}}.api.mailchimp.com/3.0';

const makeMailchimpRequest = (context, method, endpoint, args = {}) => {

    const url = `${BASE_URL}${endpoint}`.replace('{{dc}}', context.profileInfo.dc);

    // Convert args.qs to query parameters
    const queryParams = new URLSearchParams();
    Object.entries(args.qs || {}).forEach(([key, value]) => {
        if (value !== undefined) {
            queryParams.append(key, value);
        }
    });

    const queryString = queryParams.toString();
    const fullUrl = queryString ? `${url}?${queryString}` : url;
    return context.httpRequest({
        method,
        url: fullUrl,
        auth: {
            username: 'anystring',
            password: context.auth.accessToken
        },
        data: args.data
    }).then(({ data }) => data);
};


const parseData = (data) => {
    const parsedData = {};

    for (const key in data) {
        if (data.hasOwnProperty(key)) {
            let newKey = key.replace(/^data\[|\]$/g, '').replace(/\]\[/g, '.');

            if (newKey.startsWith('merges.')) {
                const subKey = newKey.replace('merges.', '');
                parsedData.merges = { ...parsedData.merges, [subKey]: data[key] };
            } else {
                parsedData[newKey] = data[key];
            }
        }
    }

    return parsedData;
};


// Expects standardized outputType: 'item', 'items', 'file'
const sendArrayOutput = async ({ context, outputPortName = 'out', outputType = 'items', records = [] }) => {
    if (outputType === 'item') {
        // One by one.
        await context.sendArray(records, outputPortName);
    } else if (outputType === 'items') {
        // All at once.
        await context.sendJson({ items: records }, outputPortName);
    } else if (outputType === 'file') {
        // Into CSV file.
        const headers = Object.keys(records[0] || {});
        let csvRows = [];
        csvRows.push(headers.join(','));
        for (const record of records) {
            const values = headers.map(header => {
                const val = record[header];
                return `"${val}"`;
            });
            // To add ',' separator between each value
            csvRows.push(values.join(','));
        }
        const csvString = csvRows.join('\n');
        let buffer = Buffer.from(csvString, 'utf8');
        const fileName = `${context.config.outputFilePrefix || 'mailchimp-export'}-${context.componentId}.csv`;
        const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);
        await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
        await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
    } else {
        throw new context.CancelError('Unsupported outputType ' + outputType);
    }
};

const registerWebhook = async (context, events) => {

    const { listId } = context.properties;
    try {
        const options = {
            data: {
                url: context.getWebhookUrl(),
                events,
                sources: {
                    user: true,
                    admin: true,
                    api: true
                }
            }
        };
        const response = await makeMailchimpRequest(context, 'POST', `/lists/${listId}/webhooks`, options);
        await context.saveState({ webhookId: response.id });
    } catch (error) {
        throw new Error(
            `Failed to register webhook in Mailchimp API: ${error?.response?.data?.errors[0]?.message}`
        );
    }
};

const unregisterWebhook = async (context) => {

    let webhookId = context.state?.webhookId;

    if (webhookId) {
        let listId = context.properties.listId;
        await makeMailchimpRequest(context, 'DELETE', `/lists/${listId}/webhooks/${webhookId}`);
    }
};

// Fetch the single newest record of a collection, sorted by creation desc. Used by
// the polling triggers' test() (Flow Test Mode): it goes through the same
// makeMailchimpRequest stack tick() uses, but bypasses the `since_*` baseline filter
// (which returns nothing on a fresh flow) so it yields a real example item.
const getLatest = async (context, endpoint, entity, sortField) => {

    const data = await makeMailchimpRequest(
        context, 'GET', `${endpoint}?count=1&sort_field=${sortField}&sort_dir=DESC`);
    return ((data && data[entity]) || [])[0] || null;
};

// Fetch the most recently changed member of a list with the given status
// ('subscribed' / 'unsubscribed'), for the webhook triggers' test().
const getLatestMember = async (context, listId, status) => {

    const data = await makeMailchimpRequest(
        context, 'GET',
        `/lists/${listId}/members?count=1&status=${status}&sort_field=last_changed&sort_dir=DESC`);
    return ((data && data.members) || [])[0] || null;
};

// Reshape a REST member object into the flat shape receive() emits from a
// subscribe/unsubscribe webhook body (i.e. parseData() output): the webhook's
// data[...] keys flattened, with merge fields grouped under `merges`.
const toSubscriberWebhookShape = (member, listId, type) => {

    if (!member) {
        return null;
    }
    return {
        type,
        fired_at: member.last_changed,
        id: member.id,
        list_id: member.list_id || listId,
        email: member.email_address,
        email_type: member.email_type,
        ip_opt: member.ip_opt,
        ip_signup: member.ip_signup,
        web_id: member.web_id,
        merges: { EMAIL: member.email_address, ...(member.merge_fields || {}) }
    };
};

module.exports = {
    sendArrayOutput,
    parseData,
    getLatest,
    getLatestMember,
    toSubscriberWebhookShape,
    lists: {
        registerWebhook,
        unregisterWebhook,
        lists: (context, args) => makeMailchimpRequest(context, 'GET', `/lists?count=${args.count}&offset=${args.offset}`, args),
        list: (context, args) => makeMailchimpRequest(context, 'GET', `/lists/${args.listId}`, args),
        addSubscriber: (context, args) => makeMailchimpRequest(context, 'PUT', `/lists/${args.listId}/members/${args.subscriberHash}`, args),
        updateSubscriber: (context, args) => makeMailchimpRequest(context, 'PATCH', `/lists/${args.listId}/members/${args.subscriberHash}`, args),
        addMemberNote: (context, args) => makeMailchimpRequest(context, 'POST', `/lists/${args.listId}/members/${args.subscriberHash}/notes`, args),
        addMemberTags: (context, args) => makeMailchimpRequest(context, 'POST', `/lists/${args.listId}/members/${args.subscriberHash}/tags`, args),
        members: (context, args) => makeMailchimpRequest(context, 'GET', `/lists/${args.listId}/members?count=${args.count}&offset=${args.offset}`, args),
        createWebhook: (context, args) => makeMailchimpRequest(context, 'POST', `/lists/${args.listId}/webhooks`, args),
        deleteWebhook: (context, args) => makeMailchimpRequest(context, 'DELETE', `/lists/${args.listId}/webhooks/${args.webhookId}`, args),
        getMergeFields: (context, args) => makeMailchimpRequest(context, 'GET', `/lists/${args.listId}/merge-fields`, args),
        deleteSubscriber: (context, args) => makeMailchimpRequest(context, 'DELETE', `/lists/${args.listId}/members/${args.subscriberId}`, args)
    },
    search: {
        members: (context, args) => makeMailchimpRequest(context, 'GET', `/search-members?query=${args.query}&list_id=${args.listId}&count=${args.count}&offset=${args.offset}`, args)
    },
    campaigns: {
        campaigns: (context, args) => makeMailchimpRequest(context, 'GET', `/campaigns?count=${args.count}&offset=${args.offset}`, args)
    },
    fileManager: {
        files: (context, args) => makeMailchimpRequest(context, 'GET', `/file-manager/files?count=${args.count}&offset=${args.offset}`, args),
        deleteFile: (context, args) => makeMailchimpRequest(context, 'DELETE', `/file-manager/files/${args.fileId}`, args)
    },
    reports: {
        findReport: (context, args) => makeMailchimpRequest(context, 'GET', `/reports/${args.campaignId}`, args)
    }
};
