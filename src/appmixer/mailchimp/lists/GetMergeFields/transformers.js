'use strict';

/**
 * @param {Object|string} message
 * @return {Array}
 */
module.exports.mergedFieldsToSelectArray = message => {

    const mergeFields = message['merge_fields'];

    let transformed = [];

    if (Array.isArray(mergeFields)) {
        mergeFields.forEach(mergeField => {

            transformed.push({
                label: mergeFields['name'],
                value: mergeFields['tag']
            });
        });
    }

    return transformed;
};

/**
 * @param {Object|string} message
 * @return {Array}
 */
module.exports.mergedFieldsToSubscriberOptions = message => {

    // subscriber fields
    let transformed = [
        { 'label': 'id', 'value': 'id' },
        { 'label': 'email_address', 'value': 'email_address' },
        { 'label': 'unique_email_id', 'value': 'unique_email_id' },
        { 'label': 'email_type', 'value': 'email_type' },
        { 'label': 'status', 'value': 'status' },
        { 'label': 'merge_fields', 'value': 'merge_fields' },
        { 'label': 'stats', 'value': 'stats' },
        { 'label': 'stats.avg_open_rate', 'value': 'stats.avg_open_rate' },
        { 'label': 'stats.avg_click_rate', 'value': 'stats.avg_click_rate' },
        { 'label': 'ip_signup', 'value': 'ip_signup' },
        { 'label': 'timestamp_signup', 'value': 'timestamp_signup' },
        { 'label': 'ip_opt', 'value': 'ip_opt' },
        { 'label': 'timestamp_opt', 'value': 'timestamp_opt' },
        { 'label': 'member_rating', 'value': 'member_rating' },
        { 'label': 'last_changed', 'value': 'last_changed' },
        { 'label': 'language', 'value': 'language' },
        { 'label': 'vip', 'value': 'vip' },
        { 'label': 'email_client', 'value': 'email_client' },
        { 'label': 'location', 'value': 'location' },
        { 'label': 'location.latitude', 'value': 'location.latitude' },
        { 'label': 'location.longitude', 'value': 'location.longitude' },
        { 'label': 'location.gmtoff', 'value': 'location.gmtoff' },
        { 'label': 'location.dstoff', 'value': 'location.dstoff' },
        { 'label': 'location.country_code', 'value': 'location.country_code' },
        { 'label': 'location.timezone', 'value': 'location.timezone' },
        { 'label': 'list_id', 'value': 'list_id' }
    ];

    if (Array.isArray(message)) {
        message.forEach(mergeField => {

            transformed.push({
                label: 'merge_fields.' + mergeField['name'],
                value: 'merge_fields.' + mergeField['tag']
            });
        });
    }

    return transformed;
};

/**
 * @param {Object|string} mergeFields
 * @return {Object}
 */
module.exports.mergeFieldsToSubscriberInspector = mergeFields => {

    let inspector = {
        inputs: {},
        groups: {
            mergeFields: { label: 'Merge Fields', index: 1 }
        }
    };

    if (Array.isArray(mergeFields)) {
        let index = 3;
        mergeFields.forEach((mergeField) => {

            if (mergeField.public) {
                inspector.inputs[mergeField.tag] = {
                    type: 'text',
                    label: mergeField.name || mergeField.tag,
                    group: 'transformation',
                    index: index++,
                    tooltip: mergeField.tag === 'BIRTHDAY'
                        ? 'Add birthday in MM/DD format'
                        : `Insert ${mergeField.name} of the subscriber`
                };
            }
        });
    }
    return inspector;
};

