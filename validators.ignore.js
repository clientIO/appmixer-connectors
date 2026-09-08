'use strict';

// Validator ignore-list (known false positives / intentional deviations)
// ----------------------------------------------------------------------
// Reports listed here are suppressed by `node scripts/validate.js` instead of
// being printed or failing CI. Every entry must record WHY it is safe to ignore
// — this list is meant to stay small and fully justified, so a reviewer can
// audit each suppression. Run `node scripts/validate.js --show-ignored` to see
// what is currently suppressed (and the reasons), and the validator prints a
// note when a rule here matches nothing (likely stale) on a full-repo run.
//
// A report (failure OR warning) is suppressed when ALL provided fields match:
//   - validator        exact validator name, e.g. 'dynamic-outport-required-inputs'
//   - messageIncludes  substring that must appear in the report message
//   - paths            (optional) repo-relative component path must CONTAIN one
//                      of these substrings. Omit only for a truly global rule —
//                      prefer scoping by path so the suppression stays narrow.
//   - reason           required human explanation (shown by --show-ignored)

module.exports = [
    {
        validator: 'find-naming-by-shape',
        messageIncludes: 'has the Find shape',
        paths: ['jira/issues/GetIssueTransitions/component.json'],
        reason: 'The component already presents as "Find Issue Transitions" via its label; the internal name/folder is kept as GetIssueTransitions to avoid a breaking rename of a published component (it is referenced by existing flows and IssueMetadata.js). Renaming would require a major bundle bump and flow migration, which is intentionally deferred.'
    },
    {
        validator: 'dynamic-outport-required-inputs',
        messageIncludes: 'ignoreAuth=true',
        paths: [
            'microsoft/dynamics/GetAccount/component.json',
            'microsoft/dynamics/GetContact/component.json',
            'microsoft/dynamics/GetLead/component.json',
            'microsoft/dynamics/GetObjectRecord/component.json',
            'microsoft/dynamics/ListAccounts/component.json',
            'microsoft/dynamics/ListContacts/component.json',
            'microsoft/dynamics/ListLeads/component.json',
            'microsoft/dynamics/DealStageChanged/component.json',
            'microsoft/dynamics/NewAccount/component.json',
            'microsoft/dynamics/NewContact/component.json',
            'microsoft/dynamics/NewLead/component.json',
            'microsoft/dynamics/NewObjectRecord/component.json',
            'microsoft/dynamics/UpdatedAccount/component.json',
            'microsoft/dynamics/UpdatedContact/component.json',
            'microsoft/dynamics/UpdatedLead/component.json',
            'microsoft/dynamics/UpdatedObjectRecord/component.json'
        ],
        reason: 'The output-port source is the DynamicEntity component, which calls the Dynamics 365 metadata API to build the variable picker. That call needs an active auth session, so ignoreAuth=true is intentionally omitted — adding it would make the dropdown request unauthenticated and fail.'
    },
    {
        validator: 'makeapicall-standards',
        messageIncludes: 'method should declare enum',
        paths: ['microsoft/dynamics/MakeApiCall/component.json'],
        reason: 'The method inspector input is a select restricted to the five HTTP verbs (GET/POST/PUT/PATCH/DELETE) with default GET, so the user cannot enter anything else. A schema-level enum is redundant for this generic helper.'
    },
    {
        validator: 'makeapicall-standards',
        messageIncludes: 'auth.scope is empty',
        paths: ['microsoft/dynamics/MakeApiCall/component.json'],
        reason: 'Dynamics 365 uses the legacy resource-based OAuth flow (authorize?resource={org url}); the access token is scoped to the org resource, not to granular OAuth scopes. The connector declares scope [] on every component by design, so MakeApiCall matches that convention.'
    },
    {
        validator: 'trigger-test-method',
        messageIncludes: 'test() should throw when no example is available',
        paths: [
            'hubspot/crm/NewContact/component.json',
            'hubspot/crm/NewDeal/component.json',
            'hubspot/crm/UpdatedContact/component.json',
            'hubspot/crm/UpdatedDeal/component.json',
            'zoho/crm/ContactCreated/component.json',
            'zoho/crm/ContactUpdated/component.json',
            'zoho/crm/LeadCreated/component.json',
            'zoho/crm/LeadUpdated/component.json'
        ],
        reason: 'These test() methods delegate the "no example" throw to the connector-shared fetchLatestExample() helper (hubspot BaseSubscriptionComponent / zoho ZohoNotifiable), which throws a CancelError when the upstream returns no record. The validator only scans the test() body for a literal throw, so it reports a false positive; the fallback-on-empty behaviour is present.'
    },
    {
        validator: 'trigger-test-method',
        messageIncludes: 'test() should throw when no example is available',
        paths: [
            'utils/controls/OnStart/component.json',
            'utils/http/Uptime/component.json',
            'utils/subflows/OnFlowCall/component.json',
            'utils/timers/Timer/component.json'
        ],
        reason: 'These sourceless triggers have no upstream to be empty: their test() always produces a deterministic/synthetic payload of the production shape (OnStart = start timestamp, Uptime = a single up/down probe result, OnFlowCall = a payload built from the configured input fields, Timer = a computed tick). There is no "no example available" case, so a throw is intentionally absent.'
    },

    // trigger-has-test-method: triggers where a test() is intentionally NOT implemented
    // (no read-only way to sample a representative production item). Grouped by reason.
    {
        validator: 'trigger-has-test-method',
        messageIncludes: 'missing a test(context) method',
        paths: [
            'utils/http/DynamicWebhook/component.json',
            'utils/http/WebhookTrigger/component.json'
        ],
        reason: 'Generic webhooks with a user-defined payload and no upstream record to fetch, so test() cannot emit a representative item.'
    },
    {
        validator: 'trigger-has-test-method',
        messageIncludes: 'missing a test(context) method',
        paths: [
            'rabbitmq/platform/NewMessage/component.json',
            'kafka/platform/NewMessage/component.json',
            'system/core/OnAnyFlowComponentError/component.json'
        ],
        reason: 'Message-queue consumers / internal engine events — consuming is destructive or there is no upstream API to read a representative item.'
    },
    {
        validator: 'trigger-has-test-method',
        messageIncludes: 'missing a test(context) method',
        paths: ['line/core/NewMessages/component.json'],
        reason: 'Inbound-only webhook with no REST endpoint to fetch a past event (LINE messaging is push/reply only — received messages cannot be listed).'
    },
    {
        validator: 'trigger-has-test-method',
        messageIncludes: 'missing a test(context) method',
        paths: [
            'microsoft/sharepoint/DeletedFile/component.json',
            'google/bigquery/DeletedRow/component.json',
            'google/drive/DeletedFileOrFolder/component.json'
        ],
        reason: 'Diff/delta-based deletion triggers — a deleted item no longer exists upstream and there is no read-only endpoint that lists "currently deleted" items, so the production payload cannot be reconstructed faithfully.'
    },
    {
        validator: 'trigger-has-test-method',
        messageIncludes: 'missing a test(context) method',
        paths: ['beehiiv/core/SurveyResponseSubmitted/component.json'],
        reason: 'Event with no read-only upstream reachable from the trigger\'s properties (beehiiv exposes no publication-wide survey-response list endpoint).'
    },
    {
        validator: 'trigger-has-test-method',
        messageIncludes: 'missing a test(context) method',
        paths: [
            'utils/test/Tick/component.json',
            'utils/storage/OnItemAdded/component.json',
            'utils/storage/OnItemRemoved/component.json',
            'utils/storage/OnItemUpdated/component.json'
        ],
        reason: 'Engine-internal triggers with no external upstream to sample: utils/test/Tick is an E2E-flow harness piece and utils/storage/* fire on internal store changes.'
    },

    // connector-has-makeapicall: connectors that intentionally ship NO generic
    // MakeApiCall component because they expose no generic authorized REST
    // surface to call. Grouped by reason.
    {
        validator: 'connector-has-makeapicall',
        messageIncludes: 'no MakeApiCall component',
        paths: [
            'appmixer/mongodb/bundle.json',
            'appmixer/mysql/bundle.json',
            'appmixer/mssql/bundle.json',
            'appmixer/postgres/bundle.json',
            'appmixer/redis/bundle.json',
            'appmixer/snowflake/bundle.json'
        ],
        reason: 'Database connectors that talk to their engine over a native driver/SQL protocol, not an HTTP REST API. There is no endpoint/method/headers surface for a generic "call any endpoint" helper to target.'
    },
    {
        validator: 'connector-has-makeapicall',
        messageIncludes: 'no MakeApiCall component',
        paths: [
            'appmixer/kafka/bundle.json',
            'appmixer/rabbitmq/bundle.json'
        ],
        reason: 'Message brokers consumed/produced over their native wire protocol (AMQP / Kafka), not HTTP. A generic REST MakeApiCall does not apply.'
    },
    {
        validator: 'connector-has-makeapicall',
        messageIncludes: 'no MakeApiCall component',
        paths: [
            'appmixer/utils/bundle.json',
            'appmixer/utils/test/bundle.json',
            'appmixer/system/bundle.json'
        ],
        reason: 'Internal/utility connectors (flow control, converters, storage, engine events) with no external service or stored credentials — there is no third-party API to call. utils/test is the E2E-flow harness module (Assert, AfterAll, ProcessE2EResults) and talks only to the engine and the internal stores.'
    },
    {
        validator: 'connector-has-makeapicall',
        messageIncludes: 'no MakeApiCall component',
        paths: ['appmixer/evernote/bundle.json'],
        reason: 'Evernote authenticates with OAuth 1.0a request signing (HMAC-SHA1) and a Thrift-based API, not a plain Bearer/API-key REST surface, so a generic header-based MakeApiCall cannot sign arbitrary requests.'
    },
    {
        validator: 'connector-has-makeapicall',
        messageIncludes: 'no MakeApiCall component',
        paths: [
            'appmixer/azureCognitiveServices/bundle.json',
            'appmixer/deepai/bundle.json',
            'appmixer/screenshotapi/bundle.json',
            'appmixer/ringring/bundle.json',
            'appmixer/exchangeratesapi/bundle.json',
            'appmixer/freeforexapi/bundle.json',
            'appmixer/vatcomply/bundle.json'
        ],
        reason: 'No connector-level auth.js — these are keyless public APIs or thin multi-module wrappers where credentials (if any) are supplied per component. There is no stored connector credential for a generic "authorized API call" to attach, so MakeApiCall has nothing to authorize.'
    },
    {
        validator: 'connector-has-makeapicall',
        messageIncludes: 'no MakeApiCall component',
        paths: ['appmixer/utils/ai/bundle.json'],
        reason: 'Internal AI utility module backed by the platform-level OpenAI key (context.config.apiKey), not a per-user connector credential. Exposing a generic "call any OpenAI endpoint" on a shared system key is inappropriate, and the dedicated openai / ai.openai connectors already provide MakeApiCall.'
    },
    {
        validator: 'delete-returns-empty',
        messageIncludes: 'must return an empty object',
        paths: [
            'google/calendar/DeleteEvent/component.json',
            'google/calendar/DeleteCalendar/component.json'
        ],
        reason: 'Pre-existing components (predate the delete-shape standard). They emit the deleted id on a "deleted" port; switching to context.sendJson({}, \'out\') would change the output contract and break existing user flows that read that port. Deferred to a future major version of the connector.'
    },
    {
        validator: 'delete-update-shape',
        messageIncludes: 'single output port named "out"',
        paths: [
            'google/calendar/DeleteEvent/component.json',
            'google/calendar/DeleteCalendar/component.json'
        ],
        reason: 'Pre-existing components (predate the delete-shape standard). Renaming the "deleted" output port to "out" is a breaking change for existing flows wired to that port, so it is deferred to a future major version of the connector.'
    },
    {
        validator: 'find-component-standards',
        messageIncludes: 'must declare an "outputType" input',
        paths: ['google/calendar/FindEvent/component.json'],
        reason: 'Pre-existing component (predates the Find outputType standard). It emits one message per matching event on "out" plus a "notFound" port; adding an outputType input would change its output shape and break existing flows, so it is deferred to a future major version of the connector.'
    },
    {
        validator: 'delete-returns-empty',
        messageIncludes: 'must return an empty object',
        paths: [
            'shopify/customers/DeleteCustomer/component.json',
            'shopify/orders/DeleteOrder/component.json',
            'shopify/products/DeleteProduct/component.json'
        ],
        reason: 'Pre-existing Shopify Delete components return the deleted resource id ({ id }) rather than {}. They predate the delete-shape standard and are wired into published flows; changing the payload/port is a breaking change deferred to a future major version. Surfaced now only because the OAuth->apiKey auth migration touched every component.json (scope removal).'
    },
    {
        validator: 'delete-update-shape',
        messageIncludes: 'single output port named "out"',
        paths: [
            'shopify/customers/DeleteCustomer/component.json',
            'shopify/orders/DeleteOrder/component.json',
            'shopify/products/DeleteProduct/component.json'
        ],
        reason: 'Pre-existing Shopify Delete components emit on a "deleted" port. Renaming to "out" breaks flows wired to that port; deferred to a future major version. Surfaced now only because the apiKey auth migration touched every component.json.'
    },
    {
        validator: 'dynamic-outport-required-inputs',
        messageIncludes: 'missing required input',
        paths: [
            'shopify/customers/CreateCustomer/component.json',
            'shopify/customers/FindCustomers/component.json',
            'shopify/customers/GetCustomer/component.json',
            'shopify/customers/UpdateCustomer/component.json'
        ],
        reason: 'The customers dynamic outPort sources are pure static field-list generators — GenerateCustomersOutput (Create/Get/UpdateCustomer) and FindCustomers own generateOutputPortOptions branch (which only needs outputType, not the required "query"). They read no service data, so the "missing required input" priming the validator wants is a false positive for a static source (it never consumes those inputs), so only that message is suppressed here.'
    },
    {
        validator: 'input-property-naming',
        paths: [
            'shopify/customers/CreateCustomer/component.json',
            'shopify/customers/UpdateCustomer/component.json',
            'shopify/orders/CountOrders/component.json',
            'shopify/orders/UpdateOrder/component.json',
            'shopify/products/CountProducts/component.json',
            'shopify/products/CreateProduct/component.json',
            'shopify/products/UpdateProduct/component.json'
        ],
        reason: 'Pre-existing snake_case input property names (created_at_min, product_type, accepts_marketing, ...) mirror the Shopify Admin API field names 1:1 and are referenced by published flows and the buildOrder/buildProduct mappers. Renaming to camelCase is a breaking change deferred to a future major version. Surfaced now only because the apiKey auth migration touched every component.json.'
    },
    {
        validator: 'delete-returns-empty',
        paths: [
            'hubspot/crm/DeleteCompany/component.json',
            'hubspot/crm/DeleteContact/component.json',
            'hubspot/crm/DeleteDeal/component.json'
        ],
        reason: 'These published Delete components return { companyId | contactId | dealId } and declare those fields as outPort options that existing flows map. Switching to the standard empty-object return is a breaking output change deferred to a future major version. Surfaced now only because the 4.8.0 quality pass touched these files.'
    },
    {
        validator: 'delete-update-shape',
        paths: [
            'hubspot/crm/UpdateCompany/component.json',
            'hubspot/crm/UpdateContact/component.json'
        ],
        reason: 'UpdateContact accepts email OR contactId (either identifies the record) and UpdateCompany resolves the company by domain, so neither has a single always-required ID input. Marking one required now would break existing flows that use the other identifier. Deferred to a future major redesign.'
    },
    {
        validator: 'find-list-no-pagination',
        paths: [
            'hubspot/crm/FindCompanies/component.json',
            'hubspot/crm/FindContacts/component.json',
            'hubspot/crm/ListContacts/component.json',
            'hubspot/crm/ListDeals/component.json'
        ],
        reason: 'The limit input is a long-published part of these components and existing flows set it. Removing it is a breaking change deferred to a future major version. Surfaced now only because the 4.8.0 quality pass touched these files.'
    },
    {
        validator: 'delete-returns-empty',
        paths: ['postgres/db/DeleteRow/component.json'],
        reason: 'Pre-existing published component: DeleteRow deletes by WHERE filter (potentially many rows) and returns { rowCount }, declared as an outPort option that existing flows map. Switching to the standard empty-object return is a breaking output change deferred to a future major version.'
    },
    {
        validator: 'delete-update-shape',
        messageIncludes: 'at least one required input',
        paths: [
            'postgres/db/DeleteRow/component.json',
            'postgres/db/UpdateRow/component.json'
        ],
        reason: 'SQL row components have no single entity-ID input by design: the target rows are selected by an arbitrary WHERE filter expression (and the required "table" lives in properties, which the validator does not count). Requiring the filter would break the legitimate "update/delete all rows" case.'
    },
    {
        validator: 'dynamic-outport-required-inputs',
        messageIncludes: 'ignoreAuth=true',
        paths: ['postgres/db/CreateRow/component.json'],
        reason: 'The newRow outPort source calls ListColumns, which runs a live information_schema query against the connected database and therefore needs the caller\'s auth account. Adding ignoreAuth=true would make the designer call it unauthenticated and fail with Invalid URL chips.'
    },
    {
        validator: 'dynamic-outport-required-inputs',
        messageIncludes: 'ignoreAuth=true',
        paths: [
            'hubspot/crm/ContactPropertyChanged/component.json',
            'hubspot/crm/NewContactInList/component.json',
            'hubspot/crm/CreateCompany/component.json',
            'hubspot/crm/CreateDeal/component.json',
            'hubspot/crm/FindCompanies/component.json',
            'hubspot/crm/FindContacts/component.json',
            'hubspot/crm/GetContact/component.json',
            'hubspot/crm/GetDeal/component.json',
            'hubspot/crm/ListContacts/component.json',
            'hubspot/crm/ListDeals/component.json',
            'hubspot/crm/NewContact/component.json',
            'hubspot/crm/NewDeal/component.json',
            'hubspot/crm/UpdateCompany/component.json',
            'hubspot/crm/UpdateContact/component.json',
            'hubspot/crm/UpdateDeal/component.json',
            'hubspot/crm/UpdatedContact/component.json',
            'hubspot/crm/UpdatedDeal/component.json',
            'hubspot/engagements/FindNotes/component.json'
        ],
        reason: 'Every hubspot dynamic outPort source resolves through the live HubSpot properties API (GetContactsProperties / GetDealsProperties / GetCompaniesProperties, either directly or via componentStaticCall inside the component\'s own generateOutputPortOptions). These calls need an authenticated session; adding ignoreAuth=true would make the dropdown request unauthenticated and fail with 500 Invalid URL chips in the designer.'
    },
    {
        validator: 'dynamic-outport-required-inputs',
        messageIncludes: 'missing "ignoreAuth=true"',
        paths: [
            'salesforce/crm/AccountStatusChange/component.json',
            'salesforce/crm/ContactStatusChange/component.json',
            'salesforce/crm/LeadStatusChange/component.json',
            'salesforce/crm/RecordFieldChange/component.json'
        ],
        reason: 'These trigger outPort sources resolve through the live Salesforce describe API (GetObjectFields / ListObjects), which reads context.auth.accessToken and context.profileInfo.instanceUrl. With ignoreAuth=true the engine calls the source without the account, the URL is built from undefined and the designer renders 500 "Invalid URL" chips (observed on dev-automated-00001, 2026-08-19). The designer sends the caller\'s bound account automatically, so the sources must keep authenticated calls.'
    },
    {
        validator: 'delete-returns-empty',
        messageIncludes: 'must return an empty object',
        paths: ['clickup/core/DeleteTask/component.json'],
        reason: 'DeleteTask has shipped since clickup 1.0.1 emitting { taskId } and published flows read $.DeleteTask.out.taskId. Narrowing the output to {} is a breaking change that needs a major bundle bump and a flow migration, so it is deferred; every Delete component added since (folders, lists, comments, checklists, goals, tags, time entries) returns {} as the standard requires.'
    },
    {
        validator: 'dynamic-outport-required-inputs',
        messageIncludes: 'missing "ignoreAuth=true"',
        paths: ['hubbi/core/NewHubEvent/component.json'],
        reason: 'NewHubEvent builds its output-port options from the hub\'s actual target fields: the generateOutputPortOptions branch calls lib.getFields(context, ENDPOINTS.targetFields, conversionKey), a live HubBI request that reads context.auth. Adding ignoreAuth=true would send that call unauthenticated and the picker would fail rather than degrade. Unlike the connector\'s List helpers, whose options come from a static schema, this source cannot be made auth-free.'
    }
];
