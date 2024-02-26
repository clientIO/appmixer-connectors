const path = require('path');
const assert = require('assert');
const _ = require('lodash');
const { getComponentJsonFiles } = require('./utils');

/** Existing components with old outports, eg. 'item','items' */
const legacyOutputTypesComponents = [
    'appmixer.asana.tasks.ListTasks',
    'appmixer.asana.tasks.ListTeams',
    'appmixer.asana.tasks.ListProjects',
    'appmixer.asana.tasks.ListUsers',
    'appmixer.dropbox.files.ListFiles',
    'appmixer.google.gmail.ListEmails',
    'appmixer.google.bigquery.ListTables',
    'appmixer.google.drive.ListFiles',
    'appmixer.google.drive.ListEmails',
    'appmixer.google.youtube.FindVideos',
    'appmixer.google.youtube.GetVideos',
    'appmixer.mailchimp.campaigns.ListCampaigns',
    'appmixer.mailchimp.files.ListFiles',
    'appmixer.mailchimp.lists.ListMembers',
    'appmixer.microsoft.mail.GetAttachments',
    'appmixer.microsoft.mail.ListEmails',
    'appmixer.microsoft.onedrive.ListFiles',
    'appmixer.microsoft.teams.ListChannelMessages',
    'appmixer.microsoft.sharepoint.ListFiles',
    'appmixer.microsoft.sharepoint.ListChannelMessages',
    'appmixer.monday.core.FindItems',
    'appmixer.mysql.db.Query',
    'appmixer.quickbooks.accounting.ListAccounts',
    'appmixer.quickbooks.accounting.ListClasses',
    'appmixer.quickbooks.accounting.ListCustomers',
    'appmixer.quickbooks.accounting.ListJournals',
    'appmixer.quickbooks.accounting.ListVendors',
    'appmixer.quickbooks.accounting.Query',
    'appmixer.servicenow.record.ListRecords',
    'appmixer.snowflake.db.Query',
    'appmixer.trello.list.ListBoards',
    'appmixer.trello.list.ListBoardsList',
    'appmixer.trello.list.ListBoardsCards',
    'appmixer.trello.list.ListBoardLabels',
    'appmixer.trello.list.ListBoardsMembers',
    'appmixer.trello.list.ListCardLabels',
    'appmixer.xero.accounting.ListAccounts',
    'appmixer.xero.accounting.ListContacts',
    'appmixer.xero.accounting.ListJournals',
    'appmixer.xero.accounting.ListTenants',
    'appmixer.xero.accounting.ListTrackingCategories',
    'appmixer.zoho.books.ListContacts',
    'appmixer.zoho.books.ListChartOfAccounts',
    'appmixer.zoho.books.ListFields',
    'appmixer.zoho.books.ListJournals',
    'appmixer.zoho.books.ListOrganizations',
    'appmixer.zoho.books.ListProjects'
];

describe('component.json', () => {

    const componentJsonFiles = getComponentJsonFiles(path.join(__dirname, '..', '..', 'src', 'appmixer'));
    componentJsonFiles.forEach(file => {

        const componentJson = require(path.join(file));

        describe(componentJson.name, () => {

            it('properties', () => {
                const componentsWithoutDescription = [
                    'appmixer.zoom.meeting.meetingCreated',
                    'appmixer.zoom.meeting.meetingDeleted',
                    'appmixer.zoom.meeting.meetingEnded',
                    'appmixer.zoom.meeting.meetingParticipantJoined',
                    'appmixer.zoom.meeting.meetingParticipantLeft',
                    'appmixer.zoom.meeting.meetingStarted',
                    'appmixer.zoom.meeting.meetingUpdated',
                    'appmixer.zoom.meeting.recordingCompleted',
                    'appmixer.zoom.meeting.recordingStopped',
                    'appmixer.zoom.meeting.recordingStarted',
                    'appmixer.zoom.meeting.appmixer.zoom.meeting.webinarParticipantJoined',
                    'appmixer.zoom.meeting.webinarParticipantJoined',
                    'appmixer.zoom.meeting.webinarParticipantLeft'
                ];
                assert(componentJson.name, 'Component should have a name');
                if (!componentsWithoutDescription.includes(componentJson.name)) {
                    assert(componentJson.description, 'Component should have a description');
                }
                if (componentJson.version) {
                    assert(/^[0-9]+\.[0-9]+\.[0-9]+$/.test(componentJson.version), 'Component should have a version in semver format');
                }
            });

            describe('inPorts', () => {

                const inPorts = componentJson.inPorts;

                // If there is outputType, check it. Find the first occurence of outputType.
                const portWithOutputType = _.find(inPorts, port => port.schema?.properties?.outputType);
                if (portWithOutputType && !legacyOutputTypesComponents.includes(componentJson.name)) {
                    it('outputType', () => {
                        if (portWithOutputType.schema.properties.outputType.enum) {
                            // enum: ["attachment", "attachments"]
                            assert.ok(portWithOutputType.schema.properties.outputType.enum, 'outputType should be an enum in schema');
                        } else {
                            assert.equal(portWithOutputType.schema.properties.outputType.type, 'string', 'outputType should be a string in schema');
                        }
                        assert.equal(portWithOutputType.inspector.inputs.outputType.type, 'select', 'outputType should be a select in inspector');
                        // Check its options: ['array', 'object', 'string', 'number', 'boolean', 'null']
                        const optionValues = portWithOutputType.inspector.inputs.outputType.options
                            .map(option => option.value);
                        assert.deepEqual(optionValues, ['array', 'object', 'file'], 'outputType should have standard options');
                    });
                }

                const required = _.first(inPorts)?.schema?.required || [];
                const schemaProperties = _.first(inPorts)?.schema?.properties || {};
                const schemaPropertyNames = Object.keys(schemaProperties);
                const inspectorInputs = _.first(inPorts)?.inspector?.inputs || {};
                const inspectorInputNames = Object.keys(inspectorInputs);

                if (schemaPropertyNames && schemaPropertyNames.length > 0) {
                    // TODO: Check generated components and decide how to proceed, eg. getCompanyCompanies
                    it.skip('schema', () => {
                        schemaPropertyNames.forEach(schemaPropertyName => {
                            assert.ok(inspectorInputNames.includes(schemaPropertyName), `Schema field [${schemaPropertyName}] should be in the inspector`);
                        });
                    });
                }

                if (required.length > 0) {
                    it('required', () => {
                        required.forEach(requiredField => {
                            assert.ok(schemaPropertyNames.includes(requiredField), `Required field [${requiredField}] should be in the schema`);
                        });
                    });
                }
            });

            describe('outPorts', () => {

                const ignoredComponents = [
                    'appmixer.plivo.calls.ForwardCall',
                    'appmixer.actimo.contacts.CreateContact',
                    'appmixer.actimo.contacts.GetContact',
                    'appmixer.actimo.contacts.GetContacts',
                    'appmixer.actimo.contacts.UpdateContact',
                    'appmixer.actimo.groups.GetGroups',
                    'appmixer.actimo.messages.SendMessage',
                    'appmixer.apify.crawlers.Crawl',
                    'appmixer.asana.projects.CreateProject',
                    'appmixer.asana.projects.DeleteProject',
                    'appmixer.asana.projects.NewProject',
                    'appmixer.asana.tasks.CreateStory',
                    'appmixer.asana.tasks.CreateSubtask',
                    'appmixer.asana.tasks.CreateTask',
                    'appmixer.asana.tasks.DeleteTask',
                    'appmixer.asana.tasks.NewComment',
                    'appmixer.asana.tasks.NewStory',
                    'appmixer.asana.tasks.NewSubtask',
                    'appmixer.asana.tasks.NewTag',
                    'appmixer.asana.tasks.NewTask',
                    'appmixer.asana.tasks.TagAdded',
                    'appmixer.asana.tasks.TaskCompleted',
                    'appmixer.asana.tasks.UpdateTask',
                    'appmixer.asana.teams.NewTeam',
                    'appmixer.azureCognitiveServices.computervision.AnalyzeImage',
                    'appmixer.calendly.events.InviteeCanceled',
                    'appmixer.calendly.events.InviteeCreated',
                    'appmixer.canvas.assignments.CreateAssignment',
                    'appmixer.canvas.submissions.GetSubmissions',
                    'appmixer.canvas.submissions.GradeOrCommentOnSubmission',
                    'appmixer.clearbit.enrichment.FindCompany',
                    'appmixer.clearbit.enrichment.FindPerson',
                    'appmixer.connectwise.core.NewContact',
                    'appmixer.connectwise.core.NewServiceTicket',
                    'appmixer.connectwise.core.postCompanyCompanies',
                    'appmixer.connectwise.core.postCompanyContacts',
                    'appmixer.connectwise.core.postServiceTickets',
                    'appmixer.connectwise.core.putServiceTicketsById',
                    'appmixer.docusign.esignature.GetEnvelope',
                    'appmixer.docusign.esignature.RequestSignature',
                    'appmixer.dropbox.files.CreateFolder',
                    'appmixer.dropbox.files.CreateTextFile',
                    'appmixer.dropbox.files.FindFiles',
                    'appmixer.dropbox.files.FindFolders',
                    'appmixer.dropbox.files.NewFile',
                    'appmixer.dropbox.files.NewFolder',
                    'appmixer.dropbox.files.RenameFile',
                    'appmixer.dropbox.files.SaveURL',
                    'appmixer.dropbox.files.UploadFile',
                    'appmixer.evernote.list.AppendToNote',
                    'appmixer.evernote.list.CreateNote',
                    'appmixer.evernote.list.CreateNotebook',
                    'appmixer.evernote.list.CreateTag',
                    'appmixer.evernote.list.FindNote',
                    'appmixer.evernote.list.NewNote',
                    'appmixer.evernote.list.NewNotebook',
                    'appmixer.evernote.list.NewReminder',
                    'appmixer.evernote.list.TagNote',
                    'appmixer.facebook.feed.NewPost',
                    'appmixer.facebook.page.CreatePagePost',
                    'appmixer.facebook.page.NewPagePost',
                    'appmixer.fakturoid.accounting.AccountUpdated',
                    'appmixer.fakturoid.accounting.CreateContact',
                    'appmixer.fakturoid.accounting.CreateInvoice',
                    'appmixer.fakturoid.accounting.FindInvoice',
                    'appmixer.fakturoid.accounting.NewEvent',
                    'appmixer.fakturoid.accounting.NewInvoice',
                    'appmixer.fakturoid.accounting.NewTodo',
                    'appmixer.fakturoid.accounting.ReportUpdated',
                    'appmixer.freshdesk.tickets.CreateTicket',
                    'appmixer.freshdesk.tickets.UpdateTicket',
                    'appmixer.github.list.CreateIssue',
                    'appmixer.github.list.NewBranch',
                    'appmixer.github.list.NewCollaborator',
                    'appmixer.github.list.NewCommit',
                    'appmixer.github.list.NewEvent',
                    'appmixer.github.list.NewGist',
                    'appmixer.github.list.NewIssue',
                    'appmixer.github.list.NewPullRequest',
                    'appmixer.github.list.NewStargazer',
                    'appmixer.google.analytics.TrackApp',
                    'appmixer.google.analytics.TrackCheckout',
                    'appmixer.google.analytics.TrackItem',
                    'appmixer.google.analytics.TrackSocial',
                    'appmixer.google.analytics.TrackTiming',
                    'appmixer.google.analytics.TrackTransaction',
                    'appmixer.google.bigquery.AddRow',
                    'appmixer.google.calendar.CreateCalendar',
                    'appmixer.google.calendar.CreateEvent',
                    'appmixer.google.calendar.DeleteCalendar',
                    'appmixer.google.calendar.DeleteEvent',
                    'appmixer.google.calendar.EventStart',
                    'appmixer.google.calendar.FindEvent',
                    'appmixer.google.calendar.FindEvent',
                    'appmixer.google.calendar.NewCalendar',
                    'appmixer.google.calendar.NewEvent',
                    'appmixer.google.calendar.UpdateEvent',
                    'appmixer.google.gmail.CreateDraft',
                    'appmixer.google.gmail.CreateLabel',
                    'appmixer.google.gmail.DeleteEmail',
                    'appmixer.google.gmail.DeleteLabel',
                    'appmixer.google.gmail.NewAttachment',
                    'appmixer.google.gmail.NewLabel',
                    'appmixer.google.gmail.NewStarredEmail',
                    'appmixer.google.gmail.SendEmail',
                    'appmixer.google.spreadsheets.CountRows',
                    'appmixer.google.spreadsheets.CreateRow',
                    'appmixer.google.spreadsheets.CreateRows',
                    'appmixer.google.youtube.GetVideos',
                    'appmixer.highrise.list.CreateCompany',
                    'appmixer.highrise.list.CreateContact',
                    'appmixer.highrise.list.CreateContactNote',
                    'appmixer.highrise.list.CreateTask',
                    'appmixer.highrise.list.NewCase',
                    'appmixer.highrise.list.NewContact',
                    'appmixer.highrise.list.NewDeal',
                    'appmixer.highrise.list.NewTask',
                    'appmixer.highrise.sync.SyncSource',
                    'appmixer.hubspot.crm.DeletedContact',
                    'appmixer.jira.issues.AssignIssue',
                    'appmixer.jira.projects.DeletedProjectWebhook',
                    'appmixer.jira.projects.GetProject',
                    'appmixer.jira.projects.NewProjectWebhook',
                    'appmixer.jira.projects.UpdateProject',
                    'appmixer.jira.projects.UpdatedProject',
                    'appmixer.jotform.core.NewFormSubmission',
                    'appmixer.mailchimp.campaigns.NewCampaign',
                    'appmixer.mailchimp.files.DeleteFile',
                    'appmixer.mailchimp.lists.DeleteSubscriber',
                    'appmixer.mailchimp.lists.List',
                    'appmixer.mailchimp.lists.NewList',
                    'appmixer.mailchimp.reports.FindReport',
                    'appmixer.mandrill.messages.SendEmail',
                    'appmixer.mandrill.messages.SendTemplate',
                    'appmixer.merk.database.GetCompanyInfo',
                    'appmixer.merk.database.SearchCompany',
                    'appmixer.merk.database.SubscriptionUpdated',
                    'appmixer.merk.database.Vocative',
                    'appmixer.microsoft.mail.MarkEmailAsRead',
                    'appmixer.microsoft.mail.MarkEmailAsUnread',
                    'appmixer.microsoft.mail.MoveMail',
                    'appmixer.microsoft.mail.SendEmail',
                    'appmixer.microsoft.mail.UpdateCategory',
                    'appmixer.microsoft.onedrive.CreateFolder',
                    'appmixer.microsoft.onedrive.GetFile',
                    'appmixer.microsoft.onedrive.ListSites',
                    'appmixer.microsoft.onedrive.MoveFileOrFolder',
                    'appmixer.microsoft.onedrive.NewFile',
                    'appmixer.microsoft.onedrive.UploadFile',
                    'appmixer.microsoft.sharepoint.CreateFolder',
                    'appmixer.microsoft.sharepoint.GetFile',
                    'appmixer.microsoft.sharepoint.MoveFileOrFolder',
                    'appmixer.microsoft.sharepoint.NewFile',
                    'appmixer.microsoft.sharepoint.UploadFile',
                    'appmixer.mysql.db.WatchRows',
                    'appmixer.mssql.db.WatchRows',
                    'appmixer.onesignal.notifications.SendPushNotification',
                    'appmixer.openai.core.cancelFineTune',
                    'appmixer.openai.core.createFineTune',
                    'appmixer.openai.core.retrieveFineTune',
                    'appmixer.pipedrive.crm.CreateActivity',
                    'appmixer.pipedrive.crm.CreateDeal',
                    'appmixer.pipedrive.crm.CreateNote',
                    'appmixer.pipedrive.crm.CreateOrganization',
                    'appmixer.pipedrive.crm.CreatePerson',
                    'appmixer.pipedrive.crm.CreateProduct',
                    'appmixer.pipedrive.crm.CreateStage',
                    'appmixer.pipedrive.crm.DealUpdated',
                    'appmixer.pipedrive.crm.DeleteGoal',
                    'appmixer.pipedrive.crm.FindDeal',
                    'appmixer.pipedrive.crm.FindOrganization',
                    'appmixer.pipedrive.crm.FindPerson',
                    'appmixer.pipedrive.crm.FindProduct',
                    'appmixer.pipedrive.crm.FindUser',
                    'appmixer.pipedrive.crm.NewActivity',
                    'appmixer.pipedrive.crm.NewDeal',
                    'appmixer.pipedrive.crm.NewGoal',
                    'appmixer.pipedrive.crm.NewNote',
                    'appmixer.pipedrive.crm.NewOrganization',
                    'appmixer.pipedrive.crm.NewPerson',
                    'appmixer.pipedrive.crm.NewPipeline',
                    'appmixer.pipedrive.crm.NewProduct',
                    'appmixer.pipedrive.crm.UpdateActivity',
                    'appmixer.pipedrive.crm.UpdateDeal',
                    'appmixer.pipedrive.crm.UpdateNote',
                    'appmixer.pipedrive.crm.UpdatePerson',
                    'appmixer.pipedrive.crm.UpdateProduct',
                    'appmixer.pipedrive.crm.UpdateStage',
                    'appmixer.plivo.calls.GatherCallInput',
                    'appmixer.plivo.calls.NewCall',
                    'appmixer.plivo.sms.SendSMSAndWaitForReply',
                    'appmixer.quickbooks.accounting.Attachable',
                    'appmixer.quickbooks.accounting.CreateBill',
                    'appmixer.quickbooks.accounting.CreateInvoice',
                    'appmixer.quickbooks.accounting.DeleteBill',
                    'appmixer.quickbooks.accounting.FindCustomer',
                    'appmixer.quickbooks.accounting.GetBill',
                    'appmixer.quickbooks.accounting.GetCompanyInfo',
                    'appmixer.quickbooks.accounting.SendInvoice',
                    'appmixer.raynet.crm.CreatePerson',
                    'appmixer.raynet.crm.FindPerson',
                    'appmixer.raynet.crm.NewPerson',
                    'appmixer.raynet.crm.UpdatePerson',
                    'appmixer.sageone.accounting.CreateProduct',
                    'appmixer.sageone.accounting.CreatePurchaseInvoice',
                    'appmixer.sageone.accounting.CreateSalesInvoice',
                    'appmixer.sageone.accounting.NewTransaction',
                    'appmixer.sageone.accounting.UpdateProduct',
                    'appmixer.salesforce.crm.CreateContact',
                    'appmixer.salesforce.crm.CreateObjectRecord',
                    'appmixer.salesforce.crm.GetObjectFields',
                    'appmixer.salesforce.crm.NewContact',
                    'appmixer.salesforce.crm.NewOpportunity',
                    'appmixer.salesforce.crm.Query',
                    'appmixer.salesforce.crm.UpdateContact',
                    'appmixer.schoology.lms.CreateAssignment',
                    'appmixer.schoology.lms.ListGradingCategories',
                    'appmixer.schoology.lms.ListGradingPeriods',
                    'appmixer.schoology.lms.ListGradingRubrics',
                    'appmixer.shopify.customers.CountCustomers',
                    'appmixer.shopify.customers.DeletedCustomer',
                    'appmixer.shopify.orders.CountOrders',
                    'appmixer.shopify.products.CountProducts',
                    'appmixer.slack.list.CreateChannel',
                    'appmixer.slack.list.CreatePrivateChannel',
                    'appmixer.slack.list.NewChannelMessage',
                    'appmixer.slack.list.NewChannelMessageRT',
                    'appmixer.slack.list.NewPrivateChannelMessage',
                    'appmixer.slack.list.NewUser',
                    'appmixer.slack.list.SendChannelMessage',
                    'appmixer.slack.list.SendPrivateChannelMessage',
                    'appmixer.trello.list.AddAttachmentToCard',
                    'appmixer.trello.list.AddLabelToCard',
                    'appmixer.trello.list.AddMemberToCard',
                    'appmixer.trello.list.ArchiveCard',
                    'appmixer.trello.list.CreateBoard',
                    'appmixer.trello.list.CreateCard',
                    'appmixer.trello.list.FindBoard',
                    'appmixer.trello.list.FindCard',
                    'appmixer.trello.list.FindMember',
                    'appmixer.trello.list.MoveCard',
                    'appmixer.trello.list.NewActivity',
                    'appmixer.trello.list.NewCard',
                    'appmixer.trello.list.NewNotification',
                    'appmixer.trello.list.UpdateBoard',
                    'appmixer.trello.list.UpdateCard',
                    'appmixer.twitter.core.CreateTweet',
                    'appmixer.userengage.conversations.NewConversation',
                    'appmixer.userengage.conversations.NewConversationMessage',
                    'appmixer.userengage.emails.NewTemplate',
                    'appmixer.userengage.events.CreateEvent',
                    'appmixer.userengage.events.NewEvent',
                    'appmixer.userengage.sync.SyncSource',
                    'appmixer.userengage.users.AddTag',
                    'appmixer.userengage.users.CreateUser',
                    'appmixer.userengage.users.FindByEmail',
                    'appmixer.userengage.users.FindByEmailAndUpdate',
                    'appmixer.userengage.users.NewUser',
                    'appmixer.userengage.users.UpdateUser',
                    'appmixer.utils.controls.Counter',
                    'appmixer.utils.controls.JoinEach',
                    'appmixer.utils.controls.JoinEach',
                    'appmixer.utils.controls.MockValue',
                    'appmixer.utils.controls.OnError',
                    'appmixer.utils.controls.OnStart',
                    'appmixer.utils.controls.Testing',
                    'appmixer.utils.csv.AddColumn',
                    'appmixer.utils.csv.AddRow',
                    'appmixer.utils.csv.DeleteColumns',
                    'appmixer.utils.csv.DeleteRows',
                    'appmixer.utils.csv.ExportCSV',
                    'appmixer.utils.csv.GetCell',
                    'appmixer.utils.csv.GetRow',
                    'appmixer.utils.csv.GetRows',
                    'appmixer.utils.csv.RenameColumn',
                    'appmixer.utils.csv.UpdateRows',
                    'appmixer.utils.files.LoadFile',
                    'appmixer.utils.files.RemoveFile',
                    'appmixer.utils.files.SaveFile',
                    'appmixer.utils.http.Delete',
                    'appmixer.utils.http.DynamicWebhook',
                    'appmixer.utils.http.Get',
                    'appmixer.utils.http.Patch',
                    'appmixer.utils.http.Post',
                    'appmixer.utils.http.Put',
                    'appmixer.utils.http.Uptime',
                    'appmixer.utils.http.Uptime',
                    'appmixer.utils.http.Webhook',
                    'appmixer.utils.storage.Clear',
                    'appmixer.utils.storage.Get',
                    'appmixer.utils.storage.ListStores',
                    'appmixer.utils.storage.OnItemAdded',
                    'appmixer.utils.storage.OnItemRemoved',
                    'appmixer.utils.storage.OnItemUpdated',
                    'appmixer.utils.storage.Remove',
                    'appmixer.utils.storage.SaveToFile',
                    'appmixer.utils.storage.Set',
                    'appmixer.utils.tasks.RequestApproval',
                    'appmixer.utils.tasks.RequestApprovalEmail',
                    'appmixer.utils.test.Tick',
                    'appmixer.utils.timers.Timer',
                    'appmixer.utils.weather.GetCurrentWeather',
                    'appmixer.utils.weather.GetWeatherForecast',
                    'appmixer.verifyemail.verify.VerifyEmail',
                    'appmixer.verifyemail.verify.VerifyEmail',
                    'appmixer.wordpress.comments.NewComment',
                    'appmixer.wordpress.posts.CreatePost',
                    'appmixer.wordpress.posts.NewPost',
                    'appmixer.zendesk.chats.CreateChat',
                    'appmixer.zoom.meeting.meeting',
                    'appmixer.zoom.meeting.meetingCreate'
                ];
                if (ignoredComponents.includes(componentJson.name)) {
                    return;
                }

                const outPorts = componentJson.outPorts;
                if (!outPorts) {
                    return;
                }

                for (const outPort of outPorts) {
                    const options = outPort.options;
                    if (options?.length) {
                        it('options', () => {
                            options.forEach(option => {
                                assert.ok(option.value, 'Option should have a value');
                                assert.ok(option.label, 'Option should have a label');
                                // Each word should start with a capital letter.
                                assert.match(option.label, /^[A-Z][A-Za-z0-9]*( [A-Z0-9][A-Za-z0-9]*)*$/, 'Option label should be in "Pascal Case": ' + option.label);
                            });
                        });
                    }
                }
            });
        });
    });
});
