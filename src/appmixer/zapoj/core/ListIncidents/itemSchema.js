module.exports = {
    _id: { type: 'string', title: 'Id' },
    notificationId: { type: 'string', title: 'Notification Id' },
    uniqVaribaleValueId: { type: 'string', title: 'Uniq Varibale Value Id' },
    phaseTitle: { type: 'string', title: 'Phase Title' },
    uniqId: { type: 'string', title: 'Uniq Id' },
    scheduleId: { type: 'string', title: 'Schedule Id' },
    organizationId: { type: 'string', title: 'Organization Id' },
    notificationTitle: { type: 'string', title: 'Notification Title' },
    incidentTemplateType: { type: 'string', title: 'Incident Template Type' },
    incidentScenarioMaster: {
        type: 'array',
        items: {}, title: 'Incident Scenario Master'
    },
    categoryName: { type: 'string', title: 'Category Name' },
    createdName: { type: 'string', title: 'Created Name' },
    created_at: { type: 'string', title: 'Created At' },
    notificationTemplate: {
        type: 'object',
        properties: {
            contacts: {
                type: 'array',
                items: {}, title: 'Notification Template.Contacts'
            },
            messageType: { type: 'string', title: 'Notification Template.Message Type' },
            pollingOptions: { type: 'string', title: 'Notification Template.Polling Options' },
            groups: {
                type: 'array',
                items: {}, title: 'Notification Template.Groups'
            },
            maps: {
                type: 'array',
                items: {}, title: 'Notification Template.Maps'
            },
            senderEmail: { type: 'string', title: 'Notification Template.Sender Email' },
            callerId: { type: 'null', title: 'Notification Template.Caller Id' },
            deliveryOrder: { type: 'string', title: 'Notification Template.Delivery Order' },
            deliveryMethod: {
                type: 'array',
                items: { type: 'string' }, title: 'Notification Template.Delivery Method'
            },
            categoryId: { type: 'string', title: 'Notification Template.Category Id' },
            copyRightId: { type: 'string', title: 'Notification Template.Copy Right Id' },
            broadCastDuration: { type: 'string', title: 'Notification Template.Broad Cast Duration' },
            contactCycles: { type: 'string', title: 'Notification Template.Contact Cycles' },
            interval: { type: 'string', title: 'Notification Template.Interval' },
            language: { type: 'string', title: 'Notification Template.Language' },
            organizationId: { type: 'string', title: 'Notification Template.Organization Id' },
            createdId: { type: 'string', title: 'Notification Template.Created Id' },
            createdName: { type: 'string', title: 'Notification Template.Created Name' },
            incidentTemplateType: { type: 'string', title: 'Notification Template.Incident Template Type' },
            incidentVariable: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                        variable_id: { type: 'string', title: 'Notification Template.Incident Variable.Variable Id' },
                        variable_name: { type: 'string', title: 'Notification Template.Incident Variable.Variable Name' }
                    }
                }, title: 'Notification Template.Incident Variable'
            },
            notificationTitle: { type: 'string', title: 'Notification Template.Notification Title' },
            priority: { type: 'string', title: 'Notification Template.Priority' },
            mode: { type: 'string', title: 'Notification Template.Mode' },
            teamData: {
                type: 'object',
                properties: {
                    teamId: { type: 'string', title: 'Notification Template.Team Data.Team Id' },
                    teamType: { type: 'string', title: 'Notification Template.Team Data.Team Type' },
                    teamName: { type: 'string', title: 'Notification Template.Team Data.Team Name' }
                }, title: 'Notification Template.Team Data'
            },
            process_name: {
                type: 'object',
                properties: {
                    id: { type: 'string', title: 'Notification Template.Process Name.Id' },
                    name: { type: 'string', title: 'Notification Template.Process Name.Name' }
                }, title: 'Notification Template.Process Name'
            },
            process_details: {
                type: 'object',
                properties: {
                    open_time: {
                        type: 'object',
                        properties: {
                            day: { type: 'string', title: 'Notification Template.Process Details.Open Time.Day' },
                            hour: { type: 'string', title: 'Notification Template.Process Details.Open Time.Hour' },
                            min: { type: 'string', title: 'Notification Template.Process Details.Open Time.Min' }
                        }, title: 'Notification Template.Process Details.Open Time'
                    },
                    response_time: {
                        type: 'object',
                        properties: {
                            day: { type: 'string', title: 'Notification Template.Process Details.Response Time.Day' },
                            hour: { type: 'string', title: 'Notification Template.Process Details.Response Time.Hour' },
                            min: { type: 'string', title: 'Notification Template.Process Details.Response Time.Min' }
                        }, title: 'Notification Template.Process Details.Response Time'
                    },
                    close_time: {
                        type: 'object',
                        properties: {
                            day: { type: 'string', title: 'Notification Template.Process Details.Close Time.Day' },
                            hour: { type: 'string', title: 'Notification Template.Process Details.Close Time.Hour' },
                            min: { type: 'string', title: 'Notification Template.Process Details.Close Time.Min' }
                        }, title: 'Notification Template.Process Details.Close Time'
                    }
                }, title: 'Notification Template.Process Details'
            },
            service_impacted: {
                type: 'object',
                properties: {
                    id: { type: 'string', title: 'Notification Template.Service Impacted.Id' },
                    name: { type: 'string', title: 'Notification Template.Service Impacted.Name' }
                }, title: 'Notification Template.Service Impacted'
            },
            manualIntegration: { type: 'boolean', title: 'Notification Template.Manual Integration' },
            responders: {
                type: 'object',
                properties: {
                    it_resolver: {
                        type: 'object',
                        properties: {
                            calendarId: { type: 'string', title: 'Notification Template.Responders.It Resolver.Calendar Id' },
                            calendarName: { type: 'string', title: 'Notification Template.Responders.It Resolver.Calendar Name' },
                            shiftId: { type: 'null', title: 'Notification Template.Responders.It Resolver.Shift Id' },
                            teamData: {
                                type: 'object',
                                properties: {
                                    teamId: { type: 'string', title: 'Notification Template.Responders.It Resolver.Team Data.Team Id' },
                                    teamType: { type: 'string', title: 'Notification Template.Responders.It Resolver.Team Data.Team Type' },
                                    teamName: { type: 'string', title: 'Notification Template.Responders.It Resolver.Team Data.Team Name' }
                                }, title: 'Notification Template.Responders.It Resolver.Team Data'
                            }
                        }, title: 'Notification Template.Responders.It Resolver'
                    }
                }, title: 'Notification Template.Responders'
            },
            _id: { type: 'string', title: 'Notification Template.Id' },
            createdById: { type: 'string', title: 'Notification Template.Created By Id' },
            createdByName: { type: 'string', title: 'Notification Template.Created By Name' },
            topicId: { type: 'string', title: 'Notification Template.Topic Id' },
            shiftIds: {
                type: 'object',
                properties: {
                    shiftId: { type: 'string', title: 'Notification Template.Shift Ids.Shift Id' },
                    calendarId: { type: 'string', title: 'Notification Template.Shift Ids.Calendar Id' }
                }, title: 'Notification Template.Shift Ids'
            },
            setting: {
                type: 'object',
                properties: {
                    _id: { type: 'string', title: 'Notification Template.Setting.Id' },
                    organizationId: { type: 'string', title: 'Notification Template.Setting.Organization Id' },
                    name: { type: 'string', title: 'Notification Template.Setting.Name' },
                    type: { type: 'string', title: 'Notification Template.Setting.Type' },
                    sender_email: { type: 'string', title: 'Notification Template.Setting.Sender Email' },
                    sender_mobile: { type: 'null', title: 'Notification Template.Setting.Sender Mobile' },
                    delivery_method: {
                        type: 'array',
                        items: { type: 'string' }, title: 'Notification Template.Setting.Delivery Method'
                    },
                    delivery_order: { type: 'string', title: 'Notification Template.Setting.Delivery Order' },
                    broadcast_duration: { type: 'string', title: 'Notification Template.Setting.Broadcast Duration' },
                    broadcast_interval: { type: 'string', title: 'Notification Template.Setting.Broadcast Interval' },
                    contact_cycles: { type: 'string', title: 'Notification Template.Setting.Contact Cycles' },
                    language: { type: 'string', title: 'Notification Template.Setting.Language' },
                    status: { type: 'number', title: 'Notification Template.Setting.Status' },
                    createdId: { type: 'number', title: 'Notification Template.Setting.Created Id' },
                    createdName: { type: 'string', title: 'Notification Template.Setting.Created Name' },
                    updated_at: { type: 'string', title: 'Notification Template.Setting.Updated At' },
                    created_at: { type: 'string', title: 'Notification Template.Setting.Created At' }
                }, title: 'Notification Template.Setting'
            }
        }, title: 'Notification Template'
    },
    messageTemplate: {
        type: 'object',
        properties: {
            _id: { type: 'string', title: 'Message Template.Id' },
            templateName: { type: 'string', title: 'Message Template.Template Name' }, title: { type: 'string', title: 'Message Template.Title' },
            sms: { type: 'string', title: 'Message Template.Sms' },
            emailMessage: { type: 'null', title: 'Message Template.Email Message' },
            speechType: { type: 'string', title: 'Message Template.Speech Type' },
            recordType: { type: 'string', title: 'Message Template.Record Type' },
            organizationId: { type: 'string', title: 'Message Template.Organization Id' },
            createdId: { type: 'string', title: 'Message Template.Created Id' },
            createdName: { type: 'string', title: 'Message Template.Created Name' },
            audioUrl: { type: 'string', title: 'Message Template.Audio Url' },
            audioUrlXml: { type: 'string', title: 'Message Template.Audio Url Xml' },
            emailSubject: { type: 'null', title: 'Message Template.Email Subject' },
            status: { type: 'number', title: 'Message Template.Status' },
            emailAttachment: { type: 'null', title: 'Message Template.Email Attachment' },
            updated_at: { type: 'string', title: 'Message Template.Updated At' },
            created_at: { type: 'string', title: 'Message Template.Created At' },
            lastModifiedId: { type: 'string', title: 'Message Template.Last Modified Id' },
            lastModifiedName: { type: 'string', title: 'Message Template.Last Modified Name' },
            lastModifiedDate: { type: 'string', title: 'Message Template.Last Modified Date' }
        }, title: 'Message Template'
    },
    copyRightTemplate: {
        type: 'object',
        properties: {
            copyRightId: { type: 'string', title: 'Copy Right Template.Copy Right Id' },
            name: { type: 'string', title: 'Copy Right Template.Name' },
            header_logo: { type: 'string', title: 'Copy Right Template.Header Logo' },
            header_text: { type: 'string', title: 'Copy Right Template.Header Text' },
            footer_text: { type: 'string', title: 'Copy Right Template.Footer Text' }
        }, title: 'Copy Right Template'
    },
    integration_type: { type: 'string', title: 'Integration Type' },
    expansionTime: { type: 'number', title: 'Expansion Time' },
    publicationTime: { type: 'string', title: 'Publication Time' },
    broadastTime: { type: 'string', title: 'Broadast Time' },
    processErrorDetails: { type: 'null', title: 'Process Error Details' },
    attemptTime: { type: 'string', title: 'Attempt Time' },
    expansion_status: { type: 'number', title: 'Expansion Status' },
    publication_status: { type: 'number', title: 'Publication Status' },
    broadcast_status: { type: 'number', title: 'Broadcast Status' },
    attempt_status: { type: 'number', title: 'Attempt Status' },
    status: { type: 'number', title: 'Status' },
    nActiveStatus: { type: 'number', title: 'N Active Status' },
    broadcastStart: { type: 'number', title: 'Broadcast Start' },
    broadcastEnd: { type: 'number', title: 'Broadcast End' },
    timeZone: { type: 'string', title: 'Time Zone' },
    templateType: { type: 'string', title: 'Template Type' },
    masterIncident: { type: 'number', title: 'Master Incident' },
    launchedDate: { type: 'string', title: 'Launched Date' },
    closePhase: { type: 'number', title: 'Close Phase' },
    closedOn: { type: 'string', title: 'Closed On' },
    closedBy: {
        type: 'array',
        items: {}, title: 'Closed By'
    },
    completeIncident: { type: 'number', title: 'Complete Incident' },
    completedOn: { type: 'string', title: 'Completed On' },
    completedBy: {
        type: 'array',
        items: {}, title: 'Completed By'
    },
    completedOnTimestamp: { type: 'string', title: 'Completed On Timestamp' },
    launchedBy: {
        type: 'object',
        properties: {
            launchedById: { type: 'string', title: 'Launched By.Launched By Id' },
            launchedByName: { type: 'string', title: 'Launched By.Launched By Name' },
            launchedByEmail: { type: 'string', title: 'Launched By.Launched By Email' }
        }, title: 'Launched By'
    },
    launchedByName: { type: 'string', title: 'Launched By Name' },
    shiftIds: {
        type: 'object',
        properties: {
            shiftId: { type: 'string', title: 'Shift Ids.Shift Id' },
            calendarId: { type: 'string', title: 'Shift Ids.Calendar Id' }
        }, title: 'Shift Ids'
    },
    topicId: { type: 'string', title: 'Topic Id' },
    internalApiKey: { type: 'string', title: 'Internal Api Key' },
    itAlertsIds: {
        type: 'array',
        items: {}, title: 'It Alerts Ids'
    },
    deliveryStatus: {
        type: 'object',
        properties: {
            smsCount: { type: 'number', title: 'Delivery Status.Sms Count' },
            emailCount: { type: 'number', title: 'Delivery Status.Email Count' },
            voiceCount: { type: 'number', title: 'Delivery Status.Voice Count' }
        }, title: 'Delivery Status'
    },
    operationsAnalytics: {
        type: 'object',
        properties: {
            openTime: { type: 'number', title: 'Operations Analytics.Open Time' },
            openTimeStatus: { type: 'number', title: 'Operations Analytics.Open Time Status' },
            responseTime: { type: 'number', title: 'Operations Analytics.Response Time' },
            responseTimeStatus: { type: 'number', title: 'Operations Analytics.Response Time Status' },
            closeTime: { type: 'number', title: 'Operations Analytics.Close Time' },
            closeTimeStatus: { type: 'number', title: 'Operations Analytics.Close Time Status' }
        }, title: 'Operations Analytics'
    },
    isResponded: { type: 'number', title: 'Is Responded' },
    isResolved: { type: 'number', title: 'Is Resolved' },
    smtpSetting: {
        type: 'object',
        properties: {
            smtpHost: { type: 'string', title: 'Smtp Setting.Smtp Host' },
            smtpPort: { type: 'string', title: 'Smtp Setting.Smtp Port' },
            smtpUsername: { type: 'string', title: 'Smtp Setting.Smtp Username' },
            smtpPassword: { type: 'string', title: 'Smtp Setting.Smtp Password' }
        }, title: 'Smtp Setting'
    },
    updated_at: { type: 'string', title: 'Updated At' },
    contactData: {
        type: 'array',
        items: {
            type: 'object',
            properties: {
                contactId: { type: 'string', title: 'Contact Data.Contact Id' }
            },
            required: [
                'contactId'
            ]
        }, title: 'Contact Data'
    },
    process: {
        type: 'object',
        properties: {
            _id: { type: 'string', title: 'Process.Id' },
            scheduleId: { type: 'string', title: 'Process.Schedule Id' },
            incidentTemplateId: { type: 'string', title: 'Process.Incident Template Id' },
            organizationId: { type: 'string', title: 'Process.Organization Id' },
            expansion_status: { type: 'number', title: 'Process.Expansion Status' },
            publication_status: { type: 'number', title: 'Process.Publication Status' },
            broadcast_status: { type: 'number', title: 'Process.Broadcast Status' },
            attempt_status: { type: 'number', title: 'Process.Attempt Status' },
            retryOn: { type: 'number', title: 'Process.Retry On' },
            retryCycle: { type: 'number', title: 'Process.Retry Cycle' },
            retryMinute: { type: 'string', title: 'Process.Retry Minute' },
            expiryOn: { type: 'number', title: 'Process.Expiry On' },
            completeIncident: { type: 'number', title: 'Process.Complete Incident' },
            attempProccessOn: { type: 'number', title: 'Process.Attemp Proccess On' },
            activeStatus: { type: 'number', title: 'Process.Active Status' },
            messageType: { type: 'string', title: 'Process.Message Type' },
            scheduleType: { type: 'string', title: 'Process.Schedule Type' },
            isMaster: { type: 'boolean', title: 'Process.Is Master' },
            order_by: { type: 'number', title: 'Process.Order By' },
            timeZone: { type: 'string', title: 'Process.Time Zone' },
            expansionOn: { type: 'string', title: 'Process.Expansion On' },
            publicationOn: { type: 'string', title: 'Process.Publication On' },
            broadcastOn: { type: 'string', title: 'Process.Broadcast On' },
            updated_at: { type: 'string', title: 'Process.Updated At' },
            created_at: { type: 'string', title: 'Process.Created At' },
            organizationName: { type: 'string', title: 'Process.Organization Name' },
            currentRoleStaff: { type: 'number', title: 'Process.Current Role Staff' },
            cycleCount: { type: 'number', title: 'Process.Cycle Count' },
            emptyRetryCount: { type: 'number', title: 'Process.Empty Retry Count' }
        }, title: 'Process'
    }
};
