'use strict';
const aggregators = require('../../aggregators');
const { sendArrayOutput } = require('../../commons');

/**
 * Component gets members of a list.
 * @extends {Component}
 */
module.exports = {

    receive(context) {

        const generateOutputPortOptions = context.properties.generateOutputPortOptions;
        const { listId, outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }

        return aggregators.getMembers({
            context, listId
        }).then(response => {
            return sendArrayOutput({ context, outputPortName: 'out', outputType, records: response });
        });
    },

    getOutputPortOptions(context, outputType) {

        if (outputType === 'item') {
            return context.sendJson(
                [
                    {
                        label: 'Id',
                        value: 'id'
                    },
                    {
                        label: 'Email Address',
                        value: 'email_address'
                    },
                    {
                        label: 'Unique Email Id',
                        value: 'unique_email_id'
                    },
                    {
                        label: 'Email Type',
                        value: 'email_type'
                    },
                    {
                        label: 'Status',
                        value: 'status'
                    },
                    {
                        label: 'Status If New',
                        value: 'status_if_new'
                    },
                    {
                        label: 'Merge Fields',
                        value: 'merge_fields'
                    },
                    {
                        label: 'Merge Fields FNAME',
                        value: 'merge_fields.FNAME'
                    },
                    {
                        label: 'Merge Fields LNAME',
                        value: 'merge_fields.LNAME'
                    },
                    {
                        label: 'Interests',
                        value: 'interests'
                    },
                    {
                        label: 'Stats',
                        value: 'stats'
                    },
                    {
                        label: 'Stats Avg Open Rate',
                        value: 'stats.avg_open_rate'
                    },
                    {
                        label: 'Stats Avg Click Rate',
                        value: 'stats.avg_click_rate'
                    },
                    {
                        label: 'Ip Signup',
                        value: 'ip_signup'
                    },
                    {
                        label: 'Timestamp Signup',
                        value: 'timestamp_signup'
                    },
                    {
                        label: 'Ip Opt',
                        value: 'ip_opt'
                    },
                    {
                        label: 'Timestamp Opt',
                        value: 'timestamp_opt'
                    },
                    {
                        label: 'Member Rating',
                        value: 'member_rating'
                    },
                    {
                        label: 'Last Changed',
                        value: 'last_changed'
                    },
                    {
                        label: 'Language',
                        value: 'language'
                    },
                    {
                        label: 'Vip',
                        value: 'vip'
                    },
                    {
                        label: 'Email Client',
                        value: 'email_client'
                    },
                    {
                        label: 'Location',
                        value: 'location'
                    },
                    {
                        label: 'Location Latitude',
                        value: 'location.latitude'
                    },
                    {
                        label: 'Location Longitude',
                        value: 'location.longitude'
                    },
                    {
                        label: 'Location Gmtoff',
                        value: 'location.gmtoff'
                    },
                    {
                        label: 'Location Dstoff',
                        value: 'location.dstoff'
                    },
                    {
                        label: 'Location Country Code',
                        value: 'location.country_code'
                    },
                    {
                        label: 'Location Timezone',
                        value: 'location.timezone'
                    },
                    {
                        label: 'List Id',
                        value: 'list_id'
                    },
                    {
                        label: 'Links',
                        value: '_links'
                    }
                ],
                'out'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Members',
                        value: 'items',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    id: {
                                        type: 'string',
                                        title: 'Id'
                                    },
                                    email_address: {
                                        type: 'string',
                                        title: 'Email Address'
                                    },
                                    unique_email_id: {
                                        type: 'string',
                                        title: 'Unique Email Id'
                                    },
                                    email_type: {
                                        type: 'string',
                                        title: 'Email Type'
                                    },
                                    status: {
                                        type: 'string',
                                        title: 'Status'
                                    },
                                    status_if_new: {
                                        type: 'string',
                                        title: 'Status If New'
                                    },
                                    merge_fields: {
                                        type: 'string',
                                        title: 'Merge Fields'
                                    },
                                    'merge_fields.FNAME': {
                                        type: 'string',
                                        title: 'Merge Fields FNAME'
                                    },
                                    'merge_fields.LNAME': {
                                        type: 'string',
                                        title: 'Merge Fields LNAME'
                                    },
                                    interests: {
                                        type: 'string',
                                        title: 'Interests'
                                    },
                                    stats: {
                                        type: 'string',
                                        title: 'Stats'
                                    },
                                    'stats.avg_open_rate': {
                                        type: 'string',
                                        title: 'Stats Avg Open Rate'
                                    },
                                    'stats.avg_click_rate': {
                                        type: 'string',
                                        title: 'Stats Avg Click Rate'
                                    },
                                    'ip_signup': {
                                        type: 'string',
                                        title: 'Ip Signup'
                                    },
                                    timestamp_signup: {
                                        type: 'string',
                                        title: 'Timestamp Signup'
                                    },
                                    ip_opt: {
                                        type: 'string',
                                        title: 'Ip Opt'
                                    },
                                    timestamp_opt: {
                                        type: 'string',
                                        title: 'Timestamp Opt'
                                    },
                                    member_rating: {
                                        type: 'string',
                                        title: 'Member Rating'
                                    },
                                    last_changed: {
                                        type: 'string',
                                        title: 'Last Changed'
                                    },
                                    language: {
                                        type: 'string',
                                        title: 'Language'
                                    },
                                    vip: {
                                        type: 'string',
                                        title: 'Vip'
                                    },
                                    email_client: {
                                        type: 'string',
                                        title: 'Email Client'
                                    },
                                    location: {
                                        type: 'string',
                                        title: 'Location'
                                    },
                                    'location.latitude': {
                                        type: 'string',
                                        title: 'Location Latitude'
                                    },
                                    'location.longitude': {
                                        type: 'string',
                                        title: 'Location Longitude'
                                    },
                                    'location.gmtoff': {
                                        type: 'string',
                                        title: 'Location Gmtoff'
                                    },
                                    'location.dstoff': {
                                        type: 'string',
                                        title: 'Location Dstoff'
                                    },
                                    'location.country_code': {
                                        type: 'string',
                                        title: 'Location Country Code'
                                    },
                                    'location.timezone': {
                                        type: 'string',
                                        title: 'Location Timezone'
                                    },
                                    list_id: {
                                        type: 'string',
                                        title: 'List Id'
                                    },
                                    _links: {
                                        type: 'string',
                                        title: 'Links'
                                    }
                                }
                            }
                        }
                    }
                ],
                'out'
            );
        } else {
            // file
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};
