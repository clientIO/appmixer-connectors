'use strict';
const crypto = require('crypto');
const mailchimpDriver = require('../../commons');

/**
 * Update an existing subscriber.
 * @extends {Component}
 */
module.exports = {
    async receive(context) {
        if (context.properties.generateInspector) {
            let subInspector = {};
            if (
                context.properties.listId &&
        context.properties.listId.indexOf('{{{') === -1
            ) {
                subInspector = await context.componentStaticCall(
                    'appmixer.mailchimp.lists.GetMergeFields',
                    'out',
                    {
                        properties: {
                            listId: context.properties.listId
                        },
                        transform: './transformers#mergeFieldsToSubscriberInspector'
                    }
                );
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
                        newEmail: {
                            type: 'string',
                            format: 'email'
                        },
                        status: {
                            type: 'string'
                        },

                        language: {
                            type: 'string'
                        },
                        vip: {
                            type: 'boolean'
                        },
                        emailType: {
                            type: 'string'
                        },
                        tags: {
                            type: 'object'
                        },
                        notes: {
                            type: 'string'
                        }
                    },
                    required: ['listId', 'email']
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
                        tooltip:
              'Enter the email address of the subscriber whose details you want to edit.',
                        required: true
                    },
                    newEmail: {
                        type: 'text',
                        label: 'New Email',
                        index: 3,
                        tooltip: 'Enter the new email address of the subscriber.',
                        required: false
                    },
                    status: {
                        type: 'select',
                        label: 'Status',
                        index: 4,
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
                    },
                    language: {
                        type: 'select',
                        label: 'Language',
                        index: 5,
                        tooltip: 'Select the language applicable to the subscriber.',
                        options: [
                            {
                                label: 'Arabic',
                                value: 'ar'
                            },
                            {
                                label: 'Afrikaans',
                                value: 'af'
                            },
                            {
                                label: 'Belarusian',
                                value: 'be'
                            },
                            {
                                label: 'Bulgarian',
                                value: 'bg'
                            },
                            {
                                label: 'Catalan',
                                value: 'ca'
                            },
                            {
                                label: 'Chinese',
                                value: 'zh'
                            },
                            {
                                label: 'Croatian',
                                value: 'hr'
                            },
                            {
                                label: 'Czech',
                                value: 'cs'
                            },
                            {
                                label: 'Danish',
                                value: 'da'
                            },
                            {
                                label: 'Dutch',
                                value: 'nl'
                            },
                            {
                                label: 'Estonian',
                                value: 'et'
                            },
                            {
                                label: 'Farsi',
                                value: 'fa'
                            },
                            {
                                label: 'Finnish',
                                value: 'fi'
                            },
                            {
                                label: 'French (France)',
                                value: 'fr'
                            },
                            {
                                label: 'French (Canada)',
                                value: 'fr_CA'
                            },
                            {
                                label: 'German',
                                value: 'de'
                            },
                            {
                                label: 'Greek',
                                value: 'el'
                            },
                            {
                                label: 'Hebrew',
                                value: 'he'
                            },
                            {
                                label: 'Hindi',
                                value: 'hi'
                            },
                            {
                                label: 'Hungarian',
                                value: 'hu'
                            },
                            {
                                label: 'Icelandic',
                                value: 'is'
                            },
                            {
                                label: 'Indonesian',
                                value: 'id'
                            },
                            {
                                label: 'Irish',
                                value: 'ga'
                            },
                            {
                                label: 'Italian',
                                value: 'it'
                            },
                            {
                                label: 'Japanese',
                                value: 'ja'
                            },
                            {
                                label: 'Khmer',
                                value: 'km'
                            },
                            {
                                label: 'Korean',
                                value: 'ko'
                            },
                            {
                                label: 'Latvian',
                                value: 'lv'
                            },
                            {
                                label: 'Lithuanian',
                                value: 'lt'
                            },
                            {
                                label: 'Maltese',
                                value: 'mt'
                            },
                            {
                                label: 'Malay',
                                value: 'ms'
                            },
                            {
                                label: 'Macedonian',
                                value: 'mk'
                            },
                            {
                                label: 'Norwegian',
                                value: 'no'
                            },
                            {
                                label: 'Polish',
                                value: 'pl'
                            },
                            {
                                label: 'Portuguese (Brazil)',
                                value: 'pt'
                            },
                            {
                                label: 'Portuguese (Portugal)',
                                value: 'pt_PT'
                            },
                            {
                                label: 'Romanian',
                                value: 'ro'
                            },
                            {
                                label: 'Russian',
                                value: 'ru'
                            },
                            {
                                label: 'Serbian',
                                value: 'sr'
                            },
                            {
                                label: 'Slovak',
                                value: 'sk'
                            },
                            {
                                label: 'Slovenian',
                                value: 'sl'
                            },
                            {
                                label: 'Spanish (Mexico)',
                                value: 'es'
                            },
                            {
                                label: 'Spanish (Spain)',
                                value: 'es_ES'
                            },
                            {
                                label: 'Swahili',
                                value: 'sw'
                            },
                            {
                                label: 'Swedish',
                                value: 'sv'
                            },
                            {
                                label: 'Tamil',
                                value: 'ta'
                            },
                            {
                                label: 'Thai',
                                value: 'th'
                            },
                            {
                                label: 'Turkish',
                                value: 'tr'
                            },
                            {
                                label: 'Ukrainian',
                                value: 'uk'
                            },
                            {
                                label: 'Vietnamese',
                                value: 'vi'
                            }
                        ]
                    },
                    vip: {
                        type: 'toggle',
                        label: 'VIP',
                        index: 6,
                        tooltip: 'Set to toggle if the subscriber is a VIP.'
                    },
                    emailType: {
                        type: 'select',
                        label: 'Email Type',
                        index: 7,
                        tooltip: 'Select the email type of the subscriber',
                        options: [
                            {
                                label: 'HTML',
                                value: 'html'
                            },
                            {
                                label: 'Plain Text',
                                value: 'text'
                            }
                        ]
                    },
                    tags: {
                        type: 'expression',
                        label: 'Tags',
                        levels: ['AND'],
                        index: 8,
                        tooltip: 'Add the tags to the subscriber.',
                        fields: {
                            name: {
                                type: 'text',
                                label: 'Name',
                                index: 1,
                                tooltip: 'Enter a name of a tag.'
                            }
                        }
                    },
                    note: {
                        type: 'text',
                        label: 'Note',
                        index: 9,
                        tooltip:
              'Enter any additional information about the subscriber you want to mention.'
                    }
                }
            };

            return context.sendJson(
                {
                    schema: Object.assign(subInspector?.schema || {}, inspector.schema),
                    inputs: Object.assign(subInspector?.inputs || {}, inspector.inputs),
                    groups: subInspector?.groups || {}
                },
                'out'
            );
        }

        const {
            listId,
            email,
            status,
            newEmail,
            language,
            vip,
            emailType,
            tags,
            note,
            ...mergeFields
        } = context.messages.in.content;

        const subscriberTags = tags?.AND?.map((tag) => {
            return {
                name: tag.name,
                status: 'active'
            };
        });

        const subscriberData = {
            status: status,
            email_address: newEmail,
            language: language,
            vip: vip,
            email_type: emailType,
            merge_fields: mergeFields
        };

        const subscriberHash = crypto
            .createHash('md5')
            .update(email.trim().toLowerCase())
            .digest('hex');

        subscriberTags &&
      (await mailchimpDriver.lists.addMemberTags(context, {
          listId,
          subscriberHash,
          data: {
              tags: subscriberTags || []
          }
      }));

        note &&
      (await mailchimpDriver.lists.addMemberNote(context, {
          listId,
          subscriberHash,
          data: {
              note
          }
      }));

        const subscriber = await mailchimpDriver.lists.updateSubscriber(context, {
            listId,
            subscriberHash,
            data: subscriberData
        });

        return context.sendJson(subscriber, 'out');
    }
};
