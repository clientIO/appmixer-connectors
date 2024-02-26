'use strict';
const crypto = require('crypto');
const mailchimpDriver = require('../../commons');

/**
 * Component add subscriber to the list
 * @extends {Component}
 */
module.exports = {

    async receive(context) {

        if (context.properties.generateInspector) {

            let subInspector = {};
            if (context.properties.listId && context.properties.listId.indexOf('{{{') === -1) {

                subInspector = await context.componentStaticCall('appmixer.mailchimp.lists.GetMergeFields', 'out', {
                    properties: {
                        listId: context.properties.listId
                    },
                    transform: './transformers#mergeFieldsToSubscriberInspector'
                });
            }

            const inspector = {
                schema: {
                    properties: {
                        listId: {
                            type: 'string'
                        },
                        email: {
                            type: 'string',
                            format: 'email'
                        },
                        status: {
                            type: 'string'
                        }
                    },
                    required: ['listId', 'email', 'status']
                },
                inputs: {
                    listId: {
                        type: 'select',
                        label: 'List/Audience',
                        index: 1,
                        required: true,
                        source: {
                            url: '/component/appmixer/mailchimp/lists/Lists?outPort=out',
                            data: {
                                transform: './transformers#listsToSelectArray'
                            }
                        }
                    },
                    email: {
                        type: 'text',
                        label: 'Email',
                        index: 2,
                        tooltip: 'Enter email address',
                        required: true
                    },
                    status: {
                        type: 'select',
                        label: 'Status',
                        index: 2,
                        tooltip: 'Select a status.',
                        defaultValue: 'subscribed',
                        options: [
                            {
                                label: 'Subscribed',
                                value: 'subscribed'
                            },
                            {
                                label: 'Unsubscribed',
                                value: 'unsubscribed'
                            },
                            {
                                label: 'Cleaned',
                                value: 'cleaned'
                            },
                            {
                                label: 'Pending',
                                value: 'pending'
                            }
                        ]
                    }
                }
            };

            return context.sendJson({
                schema: Object.assign(subInspector?.schema || {}, inspector.schema),
                inputs: Object.assign(subInspector?.inputs || {}, inspector.inputs),
                groups: subInspector?.groups || {}
            }, 'out');
        }

        const { listId, email, status, ...mergeFields } = context.messages.in.content;

        const subscriberData = {
            'status': status,
            'email_address': email,
            'merge_fields': mergeFields
        };

        const subscriberHash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
        const newSubscriber = await mailchimpDriver.lists.addSubscriber(context, {
            listId,
            subscriberHash,
            data: subscriberData
        });

        return context.sendJson(newSubscriber, 'out');
    }
};
