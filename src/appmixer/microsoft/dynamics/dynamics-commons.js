'use strict';

const _ = require('lodash');

const TTL_OUTPORT = 60 * 60 * 1000; // 1 hour for outports cache
const TTL_INSPECTOR = 60 * 60 * 1000; // 1 hour for inspector
/** Same entities as in other IPaaSes. Same set as in some components' inspectors. */
const DEFAULT_ENTITIES = [
    { label: 'Account', value: 'account' },
    { label: 'Campaign', value: 'campaign' },
    { label: 'Campaign Response', value: 'campaignresponse' },
    { label: 'Contact', value: 'contact' },
    { label: 'Incident', value: 'incident' },
    { label: 'Lead', value: 'lead' }
];

/** Dynamically generates Output Port options based on selected Entity. */
async function getOutputPortOptions(context) {

    const { logicalName = 'lead', outputType = 'object' } = context.messages.in.content;
    const resource = context.resource || context.auth.resource;
    const cacheKey = 'ms-dynamics-' + resource + '-' + logicalName + '-' + outputType + '-outport';

    if (!logicalName || !outputType || !resource) {
        throw new context.CancelError('Required properties are missing.');
    }

    if (outputType === 'file') {
        // No need for lock or to call the API.
        return [{ label: 'File ID', value: 'fileId' }];
    }

    let lock;
    try {
        lock = await context.lock(context.flowId, { retryDelay: 500 });

        const outPortCached = await context.staticCache.get(cacheKey);
        if (outPortCached) {
            return outPortCached;
        }

        const headers = {
            Accept: 'application/json',
            Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`
        };
        const urlPathAttributes = `${resource}/api/data/v9.2/EntityDefinitions(LogicalName='${logicalName}')/Attributes`;
        const optionsAttributes = {
            url: `${urlPathAttributes}?$select=LogicalName,AttributeType,DisplayName`,
            headers
        };
            // Getting all the fields from the entity.
            // Note that we are probably returning more fields than we need.
            // The default set typically includes all attributes that are used on the entity's main form,
            // plus some system attributes. However, the exact composition of the default set can vary and is not documented.
        const { data } = await context.httpRequest(optionsAttributes);

        let outPort;

        if (outputType === 'object') {

            // Convert to output port options.
            outPort = data.value.map(item => {
                let label = `${item.DisplayName?.UserLocalizedLabel?.Label} (${item.LogicalName})`;
                let value = item.LogicalName;

                if (item.AttributeType === 'Lookup') {
                    value = `_${item.LogicalName}_value`;
                }
                if (!item.DisplayName?.UserLocalizedLabel?.Label) {
                    label = item.LogicalName;
                }

                return { label, value };
            });
        } else if (outputType === 'array') {

            // Extract key, type and title from the response.
            const properties = data.value.reduce((acc, item) => {
                const property = getSchemaProperties(item.LogicalName, item.AttributeType);
                const title = `${item.DisplayName?.UserLocalizedLabel?.Label} (${item.LogicalName})`;

                let key = item.LogicalName;
                if (item.AttributeType === 'Lookup') {
                    key = `_${item.LogicalName}_value`;
                }

                acc[key] = { type: property.type, title };
                return acc;
            }, {});

            outPort = [
                {
                    label: 'Result', value: 'result',
                    schema: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties
                        }
                    }
                }
            ];
        } else {
            throw new context.CancelError('Unsupported output type.');
        }

        // Caching the result. Cached for the same time as the inspector.
        await context.staticCache.set(cacheKey, outPort, context.config?.listOutportCacheTTL || TTL_OUTPORT);

        return outPort;
    } finally {
        lock?.unlock();
    }
}

function getSchemaProperties(logicalName, attributeType) {

    const property = {};

    if (logicalName.startsWith('emailaddress')) {
        property.format = 'email';
    }

    switch (attributeType) {
        case 'Integer':
            property.type = 'number';
            break;
        case 'Boolean':
            property.type = 'boolean';
            break;
        case 'Uniqueidentifier':
            // Must be UUID otherwise the API will return an error:
            // Microsoft.OData.ODataException: Cannot convert the literal 'leadid-leadid' to the expected type 'Edm.Guid'.
            // ---> System.FormatException: Guid should contain 32 digits with 4 dashes (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
            property.type = 'string';
            property.format = 'uuid';
            break;

        default:
            property.type = 'string';
            break;
    }

    return property;
}

function getInspectorType(attributeType) {

    switch (attributeType) {
        case 'Integer':
            return 'number';
        case 'Money':
            return 'number';
        case 'DateTime':
            return 'date-time';
        case 'Boolean':
            return 'toggle';
        case 'Picklist':
        case 'Status':
            return 'select';

        default:
            // Double, Memo, String, Uniqueidentifier
            return 'text';
    }
}

function getGroup(logicalName, requiredLevel) {

    if (logicalName.startsWith('address1_')) {
        return 'address1';
    }
    if (logicalName.startsWith('address2_')) {
        return 'address2';
    }
    if (logicalName.startsWith('address3_')) {
        return 'address3';
    }

    switch (requiredLevel) {
        case 'ApplicationRequired':
        case 'Recommended':
            return 'main';

        default:
            return 'additional';
    }
}

function getGroups(objectName) {

    const groups = {
        main: {
            label: 'Main',
            index: 1
        },
        additional: {
            label: 'Additional',
            index: 2
        }
    };

    switch (objectName) {
        case 'account':
        case 'contact':
            // Contact entity has 3 addresses.
            groups.address3 = {
                label: 'Address 3',
                index: 5
            };
            // No break here.
        case 'lead':
            groups.address1 = {
                label: 'Address 1',
                index: 3
            };
            groups.address2 = {
                label: 'Address 2',
                index: 4
            };
            break;
        case 'campaign':
            // Campaign doesn't have address fields, just use main and additional groups
            break;

        default:
            break;
    }

    return groups;
}

/** Dynamically generates Inspector fields based on selected Entity. */
async function generateInspector(context, isValidFor) {

    const { objectName, rawJson, hideEntitySelection = false } = context.properties;

    // Shared "Object Name" typeahead. `text` (not `select`) so the user can also type any entity
    // logical name manually - the source only suggests the most common entities. See the
    // "List Entities" component for the full list.
    const objectNameInput = {
        label: 'Object Name',
        index: 1,
        type: 'text',
        defaultValue: objectName,
        source: {
            url: '/component/appmixer/microsoft/dynamics/CreateObjectRecord?outPort=out',
            data: {
                properties: {
                    listDefaultEntities: true
                }
            }
        },
        tooltip: 'The suggestions list only the most common entities. You can type any other '
            + 'entity logical name manually, or use the "List Entities" component to fetch the '
            + 'full list and bind its "Logical Name" output here.'
    };

    const required = ['objectName'];
    if (rawJson) {
        required.push('json');
    }
    let defaultSchema = {
        type: 'object',
        properties: {
            objectName: { type: 'string' },
            rawJson: { type: 'boolean' },
            json: { type: 'string' }
        },
        required
    };

    /** Default inspector fields: objectName, rawJson, json. */
    let defaultInputs = {
        objectName: objectNameInput,
        rawJson: {
            type: 'toggle',
            label: 'Input as raw JSON.',
            defaultValue: false,
            tooltip: 'Enable the toggle to set the input to raw JSON.',
            index: 2
        },
        json: {
            type: 'textarea',
            label: 'JSON',
            tooltip: 'The JSON representation of the object to create.',
            when: { eq: { './rawJson': true } },
            index: 3
        }
    };

    // Add ID field when updating an existing record.
    if (isValidFor === 'IsValidForUpdate') {
        defaultSchema.properties.id = { type: 'string' };
        defaultInputs.id = {
            type: 'text',
            label: 'ID',
            tooltip: 'The ID of the object to update.',
            index: 1
        };
        required.push('id');
    }

    // If the action is called with raw JSON input, return the default schema and inputs.
    // In this case there is no need to make API calls. Neither do we need to generate the inspector.
    if (rawJson || !objectName) {
        return { schema: defaultSchema, inputs: defaultInputs };
    }

    if (hideEntitySelection) {
        // Called from another component, eg: CreateLead. In this case we don't want to show the default fields.
        // Remove the default fields from the schema and inputs.
        defaultSchema = _.omit(defaultSchema, ['properties.objectName']);
        // Remove objectName from required.
        defaultSchema.required = _.without(defaultSchema.required, 'objectName');
        defaultInputs = _.omit(defaultInputs, ['objectName']);
    }

    const resource = context.resource || context.auth.resource;
    const cacheKey = 'ms-dynamics-' + resource + '-' + objectName + '-inspector-entitiy-selection-' + hideEntitySelection + '-' + isValidFor;

    let lock;
    try {
        lock = await context.lock(context.flowId, { retryDelay: 500 });

        const inPortCached = await context.staticCache.get(cacheKey);
        if (inPortCached) {
            return inPortCached;
        }

        // Generating inspector for the selected entity using the metadata APIs.
        const { schema, fieldsInputs } = await getSchemaAndInputs(context, defaultSchema, objectName, isValidFor || 'IsValidForCreate');
        const inputs = { ...defaultInputs, ...fieldsInputs };
        const inPort = { schema, inputs, groups: getGroups(objectName) };

        // Caching the inspector for 10 minutes. Primarily to speed up flow loading.
        // Cannot cache the inspector for longer because the metadata can change.
        await context.staticCache.set(cacheKey, inPort, context.config?.listInspectorCacheTTL || TTL_INSPECTOR);

        return inPort;
    } finally {
        lock?.unlock();
    }
}

async function getSchemaAndInputs(context, schema, logicalName, isValidFor) {

    const resource = context.resource || context.auth.resource;
    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`
    };
    const urlPathAttributes = `${resource}/api/data/v9.2/EntityDefinitions(LogicalName='${logicalName}')/Attributes`;

    // Getting the fields from the entity.
    const optionsAttributes = {
        url: `${urlPathAttributes}?$filter=${isValidFor} eq true&$select=LogicalName,AttributeType,${isValidFor},SchemaName,DisplayName,Description,RequiredLevel,IsCustomAttribute`,
        headers
    };

    // Getting the options for picklist fields.
    const urlPickList = `${urlPathAttributes}/Microsoft.Dynamics.CRM.PicklistAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`;
    const optionsPickList = {
        url: urlPickList,
        headers
    };

    // Getting the options for statuscode fields.
    const urlStatus = `${urlPathAttributes}/Microsoft.Dynamics.CRM.StatusAttributeMetadata?$select=LogicalName&$expand=OptionSet($select=Options)`;
    const optionsStatus = {
        url: urlStatus,
        headers
    };

    // Getting targets for Lookup fields.
    const urlLookup = `${urlPathAttributes}/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,Targets&$filter=${isValidFor} eq true`;
    const optionsLookup = {
        url: urlLookup,
        headers
    };

    // Getting DateTimeBehavior for DateTime fields.
    const urlDateTimeBehavior = `${urlPathAttributes}/Microsoft.Dynamics.CRM.DateTimeAttributeMetadata?$select=LogicalName,DateTimeBehavior`;
    const optionsDateTimeBehavior = {
        url: urlDateTimeBehavior,
        headers
    };

    // Getting the single-valued navigation property of each lookup's relationship. For a
    // polymorphic lookup (e.g. regardingobjectid) the @odata.bind property is target-specific
    // (regardingobjectid_campaign) — the bare logical name is not a valid navigation property,
    // so the bind is silently dropped and a required "regarding" object ends up missing.
    const urlRelationships = `${resource}/api/data/v9.2/EntityDefinitions(LogicalName='${logicalName}')/ManyToOneRelationships?$select=ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName`;
    const optionsRelationships = {
        url: urlRelationships,
        headers
    };

    // Await for all requests to finish.
    const [
        { data },
        { data: dataPickList },
        { data: dataStatus },
        { data: dataLookup },
        { data: dataDateTimeBehavior },
        { data: dataRelationships }
    ] = await Promise.all([
        context.httpRequest(optionsAttributes),
        context.httpRequest(optionsPickList),
        context.httpRequest(optionsStatus),
        context.httpRequest(optionsLookup),
        context.httpRequest(optionsDateTimeBehavior),
        context.httpRequest(optionsRelationships)
    ]);

    // Map each lookup attribute + referenced entity to its single-valued navigation property,
    // e.g. relationshipNavProps['regardingobjectid']['campaign'] === 'regardingobjectid_campaign'.
    const relationshipNavProps = {};
    for (const rel of dataRelationships?.value || []) {
        const attr = rel.ReferencingAttribute;
        if (!attr) {
            continue;
        }
        if (!relationshipNavProps[attr]) {
            relationshipNavProps[attr] = {};
        }
        relationshipNavProps[attr][rel.ReferencedEntity] = rel.ReferencingEntityNavigationPropertyName;
    }

    let fieldsInputs = {};
    for (let i = 0; i < data.value.length; i++) {
        const item = data.value[i];

        /** Ignored fields. Each entity has different set of fields that are marked as ValidForCreate but are not actually valid
             *  or are difficult to implement. */
        const ignoredLogicalNames = {
            lead: ['entityimage', 'customerid', 'customeridtype', 'ownerid', 'owneridtype'],
            campaign: ['regardingobjectid', 'entityimage']
        };

        if (ignoredLogicalNames[logicalName]?.includes(item.LogicalName)) {
            continue;
        }

        // Field name used in inspector can be different from LogicalName (see Lookup fields).
        let fieldName = item.LogicalName;

        // Use the single-valued navigation property for lookup fields.
        // See: https://learn.microsoft.com/en-us/power-apps/developer/data-platform/webapi/create-entity-web-api#associate-table-rows-on-create
        if (item.AttributeType === 'Lookup') {
            // Add Targets array to the item. ListLookupOptions resolves options from Targets[0].
            item.Targets = dataLookup?.value.find(x => x.LogicalName === item.LogicalName)?.Targets;
            const target = Array.isArray(item.Targets) ? item.Targets[0] : undefined;

            // The bind uses the lookup's single-valued navigation property. For a polymorphic
            // lookup (e.g. regardingobjectid) this is target-specific (regardingobjectid_campaign);
            // for a single-target lookup it is usually the logical name. Custom fields fall back to
            // SchemaName (e.g. msdyn_predictivescoreid -> msdyn_PredictiveScoreId). See:
            // https://stackoverflow.com/questions/43970292/an-undeclared-property-when-trying-to-create-record-via-web-api
            const navProperty = (target && relationshipNavProps[item.LogicalName]
                && relationshipNavProps[item.LogicalName][target])
                || (item.IsCustomAttribute ? item.SchemaName : item.LogicalName);

            // Workaround to support Lookup fields with dots in the name (| is restored to . at runtime).
            fieldName = `${navProperty}@odata|bind`;
        }

        // Add to required (non-lookup fields only). Lookup fields are exposed under a
        // target-specific navigation property name (e.g. regardingobjectid_campaign@odata|bind),
        // not their logical name, so requiring the bare logical name produces an unsatisfiable
        // schema. They are also frequently auto-populated by the Web API (transactioncurrencyid,
        // ownerid), and for polymorphic lookups we only expose one target variant — forcing it
        // would wrongly lock the user to that single target. So we never hard-require lookups.
        if (item.RequiredLevel?.Value === 'ApplicationRequired'
            && isValidFor === 'IsValidForCreate'
            && item.AttributeType !== 'Lookup') {
            schema.required.push(fieldName);
        }

        // Add to schema.
        schema.properties[fieldName] = getSchemaProperties(item.LogicalName, item.AttributeType);

        // Add to inspector fields.
        fieldsInputs[fieldName] = getInputs(item, i + 3);

        // Some DateTime fields are DateOnly, see: https://learn.microsoft.com/en-us/dynamics365/sales/developer/entities/lead#BKMK_EstimatedCloseDate
        if (item.AttributeType === 'DateTime') {
            const isDateOnly = dataDateTimeBehavior?.value.find(x => x.LogicalName === item.LogicalName)?.DateTimeBehavior.Value === 'DateOnly';
            if (isDateOnly) {
                fieldsInputs[fieldName].config = {
                    format: 'YYYY-MM-DD',
                    enableTime: false
                };
            }
        }

        // Add options for select. Picklist and Status fields.
        // See: https://www.alphabold.com/using-microsoft-dynamics-crm-api-to-get-status-reason-metadata-option/
        if (item.AttributeType === 'Picklist') {
            fieldsInputs[fieldName].options =
                    dataPickList?.value.find(x => x.LogicalName === item.LogicalName)?.OptionSet?.Options?.map(x => {
                        return { label: x.Label.UserLocalizedLabel.Label, value: String(x.Value) };
                    });
            // Reset option at the top.
            fieldsInputs[fieldName].options.unshift({ clearItem: true, content: '-- Clear selection --' });
        }
        if (item.AttributeType === 'Status') {
            fieldsInputs[fieldName].options =
                    dataStatus?.value.find(x => x.LogicalName === item.LogicalName)?.OptionSet?.Options?.map(x => {
                        return { label: x.Label.UserLocalizedLabel.Label, value: String(x.Value) };
                    });
            // Reset option at the top.
            fieldsInputs[fieldName].options.unshift({ clearItem: true, content: '-- Clear selection --' });
        }
    }

    return { schema, fieldsInputs };
}

const API_VERSION = 'v9.2';
const MAX_POLL_PAGES = 20;
// Upper bound on the number of record->stage entries kept in the trigger state so the
// state document cannot grow unbounded on orgs with many active records.
const MAX_TRACKED_STAGES = 10000;

function getAuthHeaders(context) {

    return {
        Authorization: `Bearer ${context.auth?.accessToken || context.accessToken}`,
        accept: 'application/json'
    };
}

/**
 * Baseline the polling window at flow start. Used as the `start()` hook of all the
 * polling triggers so they only emit records created/updated/transitioned after the
 * flow was started - never historical records.
 * @param {Object} context
 */
async function startPolling(context) {

    return context.saveState({ lastTimestamp: new Date().toISOString() });
}

/**
 * Resolve the entity set (URL collection segment) of an entity from the Dataverse
 * metadata. A naive `${logicalName}s` breaks for irregular plurals (opportunity ->
 * opportunities), so ask the API for the real EntitySetName and cache it.
 * @param {Object} context
 * @param {string} logicalName
 * @return {Promise<string>}
 */
async function getEntitySetName(context, logicalName) {

    const resource = context.resource || context.auth.resource;
    const cacheKey = 'ms-dynamics-' + resource + '-' + logicalName + '-entityset';

    const cached = await context.staticCache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const url = `${resource}/api/data/${API_VERSION}/EntityDefinitions(LogicalName='${logicalName}')?$select=EntitySetName`;
    const { data } = await context.httpRequest({ url, headers: getAuthHeaders(context) });
    const entitySet = data?.EntitySetName || `${logicalName}s`;

    await context.staticCache.set(cacheKey, entitySet, TTL_OUTPORT);
    return entitySet;
}

/**
 * Resolve the entity descriptor for the generic Object Record triggers. The user
 * selects any entity via the `objectName` property (same UX as the DynamicEntity /
 * CreateObjectRecord actions); the collection segment is resolved from the Dataverse
 * metadata so irregular plurals (e.g. opportunity -> opportunities) work too.
 * @param {Object} context
 * @param {string} dateField 'createdon' or 'modifiedon'
 * @return {Promise<{ logicalName: string, entitySet: string, dateField: string }>}
 */
async function resolveGenericEntity(context, dateField) {

    const objectName = context.properties.objectName;
    if (!objectName) {
        throw new context.CancelError('Object Name is required!');
    }

    const entitySet = await getEntitySetName(context, objectName);
    return { logicalName: objectName, entitySet, dateField };
}

/**
 * Polling trigger core. Queries the Dataverse OData API for records whose `dateField`
 * (createdon / modifiedon) is at or after the last seen timestamp, emits the new ones
 * (deduplicated by primary id) and persists the high-water mark in the component state.
 * @param {Object} context
 * @param {Object} entity
 * @param {string} entity.logicalName e.g. 'contact'
 * @param {string} entity.entitySet e.g. 'contacts'
 * @param {string} entity.dateField 'createdon' or 'modifiedon'
 */
async function pollEntity(context, { logicalName, entitySet, dateField }) {

    const resource = context.resource || context.auth.resource;

    const state = context.state || {};
    // The baseline is persisted by startPolling() when the flow starts; the fallback
    // only covers the edge case of the state being lost.
    const lastTimestamp = state.lastTimestamp || new Date().toISOString();
    const seenIds = new Set(Array.isArray(state.seenIds) ? state.seenIds : []);

    const url = new URL(`${resource}/api/data/${API_VERSION}/${entitySet}`);
    // `ge` (not `gt`) so records sharing the boundary timestamp are not missed; the
    // seenIds set below removes the ones already emitted on a previous tick.
    url.searchParams.append('$filter', `${dateField} ge ${lastTimestamp}`);
    url.searchParams.append('$orderby', `${dateField} asc`);

    // Dataverse uses server-driven paging - follow `@odata.nextLink` so no records are
    // missed when more than one page changed since the last tick. MAX_POLL_PAGES caps a
    // runaway backlog; anything beyond it is picked up on the next tick thanks to the
    // persisted high-water mark.
    let records = [];
    let nextUrl = url.toString();
    let pages = 0;
    while (nextUrl && pages < MAX_POLL_PAGES) {
        const { data } = await context.httpRequest({ url: nextUrl, headers: getAuthHeaders(context) });
        records = records.concat(data.value || []);
        nextUrl = data['@odata.nextLink'];
        pages += 1;
    }

    if (records.length === 0) {
        // Nothing new. Persist the baseline if it isn't stored yet, otherwise the window
        // would slide forward with every empty tick and records created between ticks
        // would never match the `ge lastTimestamp` filter.
        if (!state.lastTimestamp) {
            await context.saveState({ lastTimestamp, seenIds: [] });
        }
        return;
    }

    const idField = `${logicalName}id`;

    // New high-water mark = newest timestamp returned (ISO 8601 strings sort lexicographically).
    let maxTimestamp = lastTimestamp;
    for (const record of records) {
        if (record[dateField] && record[dateField] > maxTimestamp) {
            maxTimestamp = record[dateField];
        }
    }

    for (const record of records) {
        if (seenIds.has(record[idField])) {
            // Already emitted on an earlier tick (records sitting on the boundary timestamp).
            continue;
        }
        await context.sendJson(record, 'out');
    }

    // Carry forward only the ids sitting exactly on the new high-water mark - those are the
    // ones a `ge maxTimestamp` query returns again next tick and must be skipped.
    const boundaryIds = records
        .filter(record => record[dateField] === maxTimestamp)
        .map(record => record[idField]);

    await context.saveState({ lastTimestamp: maxTimestamp, seenIds: boundaryIds });
}

/**
 * Polling trigger core for stage-change detection. Polls records modified since the last
 * tick and compares the value of `stageField` against the stage remembered for each record
 * in the component state. A record is emitted only when it was already seen with a
 * different stage - the first time a record is observed it is just baselined, so records
 * that were merely created or edited (without a stage transition) never fire the trigger.
 * @param {Object} context
 * @param {Object} entity
 * @param {string} entity.entitySet e.g. 'opportunities'
 * @param {string} entity.idField e.g. 'opportunityid'
 * @param {string} entity.stageField e.g. 'salesstage'
 */
async function pollStageChanges(context, { entitySet, idField, stageField }) {

    const resource = context.resource || context.auth.resource;

    const state = context.state || {};
    const stages = state.stages || {};
    // The baseline is persisted by startPolling() when the flow starts; the fallback
    // only covers the edge case of the state being lost.
    const lastTimestamp = state.lastTimestamp || new Date().toISOString();

    const url = new URL(`${resource}/api/data/${API_VERSION}/${entitySet}`);
    // `ge` (not `gt`) so records sharing the boundary timestamp are not missed; re-reading
    // a boundary record is harmless here because its remembered stage already matches.
    url.searchParams.append('$filter', `modifiedon ge ${lastTimestamp}`);
    url.searchParams.append('$orderby', 'modifiedon asc');

    // Follow `@odata.nextLink` server-driven paging, same as pollEntity.
    let records = [];
    let nextUrl = url.toString();
    let pages = 0;
    while (nextUrl && pages < MAX_POLL_PAGES) {
        const { data } = await context.httpRequest({ url: nextUrl, headers: getAuthHeaders(context) });
        records = records.concat(data.value || []);
        nextUrl = data['@odata.nextLink'];
        pages += 1;
    }

    if (records.length === 0) {
        // Persist the baseline if it isn't stored yet, otherwise the window would slide
        // forward with every empty tick (see pollEntity).
        if (!state.lastTimestamp) {
            await context.saveState({ lastTimestamp, stages });
        }
        return;
    }

    let maxTimestamp = lastTimestamp;
    for (const record of records) {
        if (record.modifiedon && record.modifiedon > maxTimestamp) {
            maxTimestamp = record.modifiedon;
        }
    }

    for (const record of records) {
        const id = record[idField];
        if (!id) {
            continue;
        }
        // Stage values can be numbers (picklists) or strings - normalize for comparison.
        const current = record[stageField] === undefined || record[stageField] === null
            ? null
            : String(record[stageField]);
        const previous = Object.prototype.hasOwnProperty.call(stages, id) ? stages[id] : undefined;

        if (previous !== undefined && previous !== current) {
            await context.sendJson(record, 'out');
        }
        stages[id] = current;
    }

    // Evict the longest-tracked entries when over the cap. Plain objects preserve insertion
    // order for string keys, so the leading keys are the ones first seen.
    const trackedIds = Object.keys(stages);
    if (trackedIds.length > MAX_TRACKED_STAGES) {
        for (const id of trackedIds.slice(0, trackedIds.length - MAX_TRACKED_STAGES)) {
            delete stages[id];
        }
    }

    await context.saveState({ lastTimestamp: maxTimestamp, stages });
}

/**
 * Fetch the single most-recent record for Flow Test Mode. Uses the same OData endpoint
 * as pollEntity but ordered newest-first with no state baseline, so the test always
 * produces one realistic item (or undefined when the entity has no records).
 * @param {Object} context
 * @param {Object} entity
 * @param {string} entity.entitySet
 * @param {string} entity.dateField
 * @return {Promise<Object|undefined>}
 */
async function fetchLatestRecord(context, { entitySet, dateField }) {

    const resource = context.resource || context.auth.resource;
    const url = new URL(`${resource}/api/data/${API_VERSION}/${entitySet}`);
    url.searchParams.append('$orderby', `${dateField} desc`);
    url.searchParams.append('$top', '1');

    const { data } = await context.httpRequest({ url: url.toString(), headers: getAuthHeaders(context) });
    return (data.value || [])[0];
}

function getInputs(item, index) {

    const label = `${item.DisplayName?.UserLocalizedLabel?.Label} (${item.LogicalName})`;
    const tooltip = item.Description?.UserLocalizedLabel?.Label;

    // Lookup fields. Call ListLookupOptions action to get the options.
    if (item.AttributeType === 'Lookup') {
        return {
            index,
            type: 'text',
            source: {
                url: '/component/appmixer/microsoft/dynamics/ListLookupOptions?outPort=out',
                data: {
                    messages: {
                        'in/targets': item.Targets,
                        'in/isSource': true
                    }
                }
            },
            label,
            tooltip,
            group: getGroup(item.LogicalName, item.RequiredLevel?.Value)
        };
    }

    // Non Lookup fields.
    return {
        index,
        type: getInspectorType(item.AttributeType),
        label,
        tooltip,
        group: getGroup(item.LogicalName, item.RequiredLevel?.Value)
    };
}

module.exports = {
    DEFAULT_ENTITIES,
    getOutputPortOptions,
    getSchemaProperties,
    getInspectorType,
    getGroups,
    generateInspector,
    getEntitySetName,
    resolveGenericEntity,
    startPolling,
    pollEntity,
    pollStageChanges,
    fetchLatestRecord
};
