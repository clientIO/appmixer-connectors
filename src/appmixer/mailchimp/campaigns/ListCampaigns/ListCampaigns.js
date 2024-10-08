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
        const { outputType } = context.messages.in.content;

        if (generateOutputPortOptions) {
            return this.getOutputPortOptions(context, outputType);
        }


        return aggregators.getCampaigns({
            context
        }).then(campaigns => {
            return sendArrayOutput({ context, outputPortName: 'out', outputType, records: campaigns });
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
                        label: 'Archive Url',
                        value: 'archive_url'
                    },
                    {
                        label: 'Content Type',
                        value: 'content_type'
                    },
                    {
                        label: 'Create Time',
                        value: 'create_time'
                    },
                    {
                        label: 'Delivery Status Enabled',
                        value: 'delivery_status.enabled'
                    },
                    {
                        label: 'Emails Sent',
                        value: 'emails_sent'
                    },
                    {
                        label: 'Long Archive Url',
                        value: 'long_archive_url'
                    },
                    {
                        label: 'Needs Block Refresh',
                        value: 'needs_block_refresh'
                    },
                    {
                        label: 'Recipients List Id',
                        value: 'recipients.list_id'
                    },
                    {
                        label: 'Recipients List Name',
                        value: 'recipients.list_name'
                    },
                    {
                        label: 'Recipients Recipient Count',
                        value: 'recipients.recipient_count'
                    },
                    {
                        label: 'Recipients Segment Text',
                        value: 'recipients.segment_text'
                    },
                    {
                        label: 'Report Summary Clicks',
                        value: 'report_summary.clicks'
                    },
                    {
                        label: 'Report Summary Click Rate',
                        value: 'report_summary.click_rate'
                    },
                    {
                        label: 'Report Summary Ecommerce Total Orders',
                        value: 'report_summary.ecommerce.total_orders'
                    },
                    {
                        label: 'Report Summary Ecommerce Total Revenue',
                        value: 'report_summary.ecommerce.total_revenue'
                    },
                    {
                        label: 'Report Summary Ecommerce Total Spent',
                        value: 'report_summary.ecommerce.total_spent'
                    },
                    {
                        label: 'Report Summary Opens',
                        value: 'report_summary.opens'
                    },
                    {
                        label: 'Report Summary Open Rate',
                        value: 'report_summary.open_rate'
                    },
                    {
                        label: 'Report Summary Subscriber Clicks',
                        value: 'report_summary.subscriber_clicks'
                    },
                    {
                        label: 'Report Summary Unique Opens',
                        value: 'report_summary.unique_opens'
                    },
                    {
                        label: 'Send Time',
                        value: 'send_time'
                    },
                    {
                        label: 'Settings Authenticate',
                        value: 'settings.authenticate'
                    },
                    {
                        label: 'Settings Auto Footer',
                        value: 'settings.auto_footer'
                    },
                    {
                        label: 'Settings Auto Tweet',
                        value: 'settings.auto_tweet'
                    },
                    {
                        label: 'Settings Drag And Drop',
                        value: 'settings.drag_and_drop'
                    },
                    {
                        label: 'Settings Fb Comments',
                        value: 'settings.fb_comments'
                    },
                    {
                        label: 'Settings Folder Id',
                        value: 'settings.folder_id'
                    },
                    {
                        label: 'Settings From Name',
                        value: 'settings.from_name'
                    },
                    {
                        label: 'Settings Inline Css',
                        value: 'settings.inline_css'
                    },
                    {
                        label: 'Settings Preview Text',
                        value: 'settings.preview_text'
                    },
                    {
                        label: 'Settings Reply To',
                        value: 'settings.reply_to'
                    },
                    {
                        label: 'Settings Subject Line',
                        value: 'settings.subject_line'
                    },
                    {
                        label: 'Settings Template Id',
                        value: 'settings.template_id'
                    },
                    {
                        label: 'Settings Timewarp',
                        value: 'settings.timewarp'
                    },
                    {
                        label: 'Settings Title',
                        value: 'settings.title'
                    },
                    {
                        label: 'Settings To Name',
                        value: 'settings.to_name'
                    },
                    {
                        label: 'Settings Use Conversation',
                        value: 'settings.use_conversation'
                    },
                    {
                        label: 'Status',
                        value: 'status'
                    },
                    {
                        label: 'Tracking Clicktale',
                        value: 'tracking.clicktale'
                    },
                    {
                        label: 'Tracking Ecomm 360',
                        value: 'tracking.ecomm360'
                    },
                    {
                        label: 'Tracking Goal Tracking',
                        value: 'tracking.goal_tracking'
                    },
                    {
                        label: 'Tracking Google Analytics',
                        value: 'tracking.google_analytics'
                    },
                    {
                        label: 'Tracking Html Clicks',
                        value: 'tracking.html_clicks'
                    },
                    {
                        label: 'Tracking Opens',
                        value: 'tracking.opens'
                    },
                    {
                        label: 'Tracking Text Clicks',
                        value: 'tracking.text_clicks'
                    },
                    {
                        label: 'Type',
                        value: 'type'
                    },
                    {
                        label: 'Web Id',
                        value: 'web_id'
                    }
                ],
                'out'
            );
        } else if (outputType === 'items') {
            return context.sendJson(
                [
                    {
                        label: 'Campaigns',
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
                                    archive_url: {
                                        type: 'string',
                                        title: 'Archive Url'
                                    },
                                    content_type: {
                                        type: 'string',
                                        title: 'Content Type'
                                    },
                                    create_time: {
                                        type: 'string',
                                        title: 'Create Time'
                                    },
                                    'delivery_status.enabled': {
                                        type: 'string',
                                        title: 'Delivery Status Enabled'
                                    },
                                    emails_sent: {
                                        type: 'string',
                                        title: 'Emails Sent'
                                    },
                                    long_archive_url: {
                                        type: 'string',
                                        title: 'Long Archive Url'
                                    },
                                    needs_block_refresh: {
                                        type: 'string',
                                        title: 'Needs Block Refresh'
                                    },
                                    'recipients.list_id': {
                                        type: 'string',
                                        title: 'Recipients List Id'
                                    },
                                    'recipients.list_name': {
                                        type: 'string',
                                        title: 'Recipients List Name'
                                    },
                                    'recipients.recipient_count': {
                                        type: 'string',
                                        title: 'Recipients Recipient Count'
                                    },
                                    'recipients.segment_text': {
                                        type: 'string',
                                        title: 'Recipients Segment Text'
                                    },
                                    'report_summary.clicks': {
                                        type: 'string',
                                        title: 'Report Summary Clicks'
                                    },
                                    'report_summary.click_rate': {
                                        'type': 'string',
                                        'title': 'Report Summary Click Rate'
                                    },
                                    'report_summary.ecommerce.total_orders': {
                                        'type': 'string',
                                        'title': 'Report Summary Ecommerce Total Orders'
                                    },
                                    'report_summary.ecommerce.total_revenue': {
                                        'type': 'string',
                                        'title': 'Report Summary Ecommerce Total Revenue'
                                    },
                                    'report_summary.ecommerce.total_spent': {
                                        'type': 'string',
                                        'title': 'Report Summary Ecommerce Total Spent'
                                    },
                                    'report_summary.opens': {
                                        'type': 'string',
                                        'title': 'Report Summary Opens'
                                    },
                                    'report_summary.open_rate': {
                                        'type': 'string',
                                        'title': 'Report Summary Open Rate'
                                    },
                                    'report_summary.subscriber_clicks': {
                                        'type': 'string',
                                        'title': 'Report Summary Subscriber Clicks'
                                    },
                                    'report_summary.unique_opens': {
                                        'type': 'string',
                                        'title': 'Report Summary Unique Opens'
                                    },
                                    'send_time': {
                                        'type': 'string',
                                        'title': 'Send Time'
                                    },
                                    'settings.authenticate': {
                                        'type': 'string',
                                        'title': 'Settings Authenticate'
                                    },
                                    'settings.auto_footer': {
                                        'type': 'string',
                                        'title': 'Settings Auto Footer'
                                    },
                                    'settings.auto_tweet': {
                                        'type': 'string',
                                        'title': 'Settings Auto Tweet'
                                    },
                                    'settings.drag_and_drop': {
                                        'type': 'string',
                                        'title': 'Settings Drag And Drop'
                                    },
                                    'settings.fb_comments': {
                                        'type': 'string',
                                        'title': 'Settings Fb Comments'
                                    },
                                    'settings.folder_id': {
                                        'type': 'string',
                                        'title': 'Settings Folder Id'
                                    },
                                    'settings.from_name': {
                                        'type': 'string',
                                        'title': 'Settings From Name'
                                    },
                                    'settings.inline_css': {
                                        'type': 'string',
                                        'title': 'Settings Inline Css'
                                    },
                                    'settings.preview_text': {
                                        'type': 'string',
                                        'title': 'Settings Preview Text'
                                    },
                                    'settings.reply_to': {
                                        'type': 'string',
                                        'title': 'Settings Reply To'
                                    },
                                    'settings.subject_line': {
                                        'type': 'string',
                                        'title': 'Settings Subject Line'
                                    },
                                    'settings.template_id': {
                                        'type': 'string',
                                        'title': 'Settings Template Id'
                                    },
                                    'settings.timewarp': {
                                        'type': 'string',
                                        'title': 'Settings Timewarp'
                                    },
                                    'settings.title': {
                                        'type': 'string',
                                        'title': 'Settings Title'
                                    },
                                    'settings.to_name': {
                                        'type': 'string',
                                        'title': 'Settings To Name'
                                    },
                                    'settings.use_conversation': {
                                        'type': 'string',
                                        'title': 'Settings Use Conversation'
                                    },
                                    'status': {
                                        'type': 'string',
                                        'title': 'Status'
                                    },
                                    'tracking.clicktale': {
                                        'type': 'string',
                                        'title': 'Tracking Clicktale'
                                    },
                                    'tracking.ecomm360': {
                                        'type': 'string',
                                        'title': 'Tracking Ecomm 360'
                                    },
                                    'tracking.goal_tracking': {
                                        'type': 'string',
                                        'title': 'Tracking Goal Tracking'
                                    },
                                    'tracking.google_analytics': {
                                        'type': 'string',
                                        'title': 'Tracking Google Analytics'
                                    },
                                    'tracking.html_clicks': {
                                        'type': 'string',
                                        'title': 'Tracking Html Clicks'
                                    },
                                    'tracking.opens': {
                                        'type': 'string',
                                        'title': 'Tracking Opens'
                                    },
                                    'tracking.text_clicks': {
                                        'type': 'string',
                                        'title': 'Tracking Text Clicks'
                                    },
                                    'type': {
                                        'type': 'string',
                                        'title': 'Type'
                                    },
                                    'web_id': {
                                        'type': 'string',
                                        'title': 'Web Id'
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
