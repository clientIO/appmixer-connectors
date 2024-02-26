'use strict';
const oneDriveAPI = require('onedrive-api');


const listItems = async (context, apiUrl) => {

    const { driveType } = await oneDriveAPI.items.customEndpoint({
        accessToken: context.auth.accessToken,
        url: `me/drive`,
        method: 'GET'
    });
    if(driveType !== 'business') return [];

    const { limit } = context.messages.in.content;
    const MAX_LIMIT = limit || 100;
    const PAGE_SIZE = 50;

    let items = [];
    let nextLink = null;
    let totalItems = 0;

    do {
        const result = await oneDriveAPI.items.customEndpoint({
            accessToken: context.auth.accessToken,
            url: `${apiUrl}$top=${Math.min(PAGE_SIZE, MAX_LIMIT - totalItems)}`,
            method: 'GET'
        });
        items = items.concat(result.value);
        nextLink = result['@odata.nextLink'];
        totalItems += result.value.length;
    } while (nextLink && totalItems < MAX_LIMIT);

    return items;
};


module.exports = {
    listItems
};
