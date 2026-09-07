'use strict';

const pathModule = require('path');

const DEFAULT_PREFIX = 'epic-objects-export';

module.exports = {

    async sendArrayOutput({
        context,
        outputPortName = 'out',
        outputType = 'array',
        records = []
    }) {

        if (outputType === 'first') {
            if (records.length === 0) {
                throw new context.CancelError('No records available for first output type');
            }
            // Just the first one.
            await context.sendJson(
                { ...records[0], index: 0, count: records.length },
                outputPortName
            );
        } else if (outputType === 'object') {
            // One by one.
            for (let index = 0; index < records.length; index++) {
                await context.sendJson(
                    { ...records[index], index, count: records.length },
                    outputPortName
                );
            }
        } else if (outputType === 'array') {
            // All at once.
            await context.sendJson({ result: records, count: records.length }, outputPortName);
        } else if (outputType === 'file') {

            // Into CSV file.
            const csvString = toCsv(records);

            let buffer = Buffer.from(csvString, 'utf8');
            const componentName = context.flowDescriptor[context.componentId].label || context.componentId;
            const fileName = `${context.config.outputFilePrefix || DEFAULT_PREFIX}-${componentName}.csv`;
            const savedFile = await context.saveFileStream(pathModule.normalize(fileName), buffer);

            await context.log({ step: 'File was saved', fileName, fileId: savedFile.fileId });
            await context.sendJson({ fileId: savedFile.fileId }, outputPortName);
        } else {
            throw new context.CancelError('Unsupported outputType ' + outputType);
        }
    },

    getOutputPortOptions(context, outputType, itemSchema, { label }) {

        if (outputType === 'object' || outputType === 'first') {
            const options = Object.keys(itemSchema)
                .reduce((res, field) => {
                    const schema = itemSchema[field];
                    const { title: label, ...schemaWithoutTitle } = schema;

                    res.push({
                        label, value: field, schema: schemaWithoutTitle
                    });
                    return res;
                }, [{
                    label: 'Current Item Index',
                    value: 'index',
                    schema: { type: 'integer' }
                }, {
                    label: 'Items Count',
                    value: 'count',
                    schema: { type: 'integer' }
                }]);

            return context.sendJson(options, 'out');
        }

        if (outputType === 'array') {
            return context.sendJson([{
                label: 'Items Count',
                value: 'count',
                schema: { type: 'integer' }
            }, {
                label: label,
                value: 'result',
                schema: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: itemSchema
                    }
                }
            }], 'out');
        }

        if (outputType === 'file') {
            return context.sendJson([{ label: 'File ID', value: 'fileId' }], 'out');
        }
    }
};

const toCsv = (array) => {

    const headers = Object.keys(array[0]);

    return [
        headers.join(','),
        ...array.map(items => {

            return Object.values(items).map(property => {
                if (typeof property === 'object') {
                    return JSON.stringify(property);
                }
                return property;
            }).join(',');
        })
    ].join('\n');
};

// Epic on FHIR R4. The public Epic sandbox base URL is used by default. A
// different organisation endpoint can be supplied via the instance config
// (`config.epicFhirBaseUrl`) without changing component code.
const FHIR_BASE_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/api/FHIR/R4';

// OAuth2 (SMART on FHIR) endpoints for the Epic sandbox.
const OAUTH_BASE_URL = 'https://fhir.epic.com/interconnect-fhir-oauth/oauth2';

function getFhirBaseUrl(context) {

    const fromConfig = context.config && context.config.epicFhirBaseUrl;
    return (fromConfig || FHIR_BASE_URL).replace(/\/+$/, '');
}

// OAuth2 endpoints for the organisation the connector talks to. Every Epic
// customer hosts its own authorize/token endpoints next to its FHIR API.
// Precedence: explicit `config.epicOauthBaseUrl` → derived from
// `config.epicFhirBaseUrl` (Epic's standard interconnect layout puts OAuth at
// `<interconnect>/oauth2` next to `<interconnect>/api/FHIR/R4`) → the public
// sandbox default.
function getOauthBaseUrl(context) {

    const fromConfig = context.config && context.config.epicOauthBaseUrl;
    if (fromConfig) {
        return fromConfig.replace(/\/+$/, '');
    }

    const fhirBase = getFhirBaseUrl(context);
    if (fhirBase !== FHIR_BASE_URL) {
        const interconnect = fhirBase.replace(/\/api\/FHIR\/[^/]+$/i, '');
        if (interconnect !== fhirBase) {
            return `${interconnect}/oauth2`;
        }
    }

    return OAUTH_BASE_URL;
}

// Perform a FHIR request against the configured base URL using the OAuth2
// access token. `resource` is the path after the base URL, e.g.
// `Patient/123` or `Condition`.
async function fhirRequest(context, { method = 'GET', resource, params } = {}) {

    const response = await context.httpRequest({
        method,
        url: `${getFhirBaseUrl(context)}/${resource}`,
        headers: {
            'Authorization': `Bearer ${context.auth.accessToken}`,
            'Accept': 'application/fhir+json'
        },
        params
    });

    return response.data;
}

// Extract the resources from a FHIR searchset Bundle, skipping OperationOutcome
// and other non-resource entries.
function extractResources(bundle) {

    if (!bundle || !Array.isArray(bundle.entry)) {
        return [];
    }

    return bundle.entry
        .map(entry => entry && entry.resource)
        .filter(resource => resource && resource.resourceType && resource.resourceType !== 'OperationOutcome');
}

// Shared behaviour for the patient-anchored Find components. Every clinical
// resource in this connector is searched by patient and returned as a set, so
// the logic only differs by resource type, the inspector label, the item
// schema (for the variable picker) and any fixed extra search params (e.g. the
// Observation category).
async function runPatientSearch(context, { resourceType, label, schema, extraParams = {} }) {

    const { patient, outputType } = context.messages.in.content;

    if (context.properties.generateOutputPortOptions) {
        return module.exports.getOutputPortOptions(context, outputType, schema, { label });
    }

    if (!patient) {
        throw new context.CancelError('Patient ID is required!');
    }

    const bundle = await fhirRequest(context, {
        resource: resourceType,
        params: { patient, ...extraParams }
    });

    const records = extractResources(bundle);

    if (records.length === 0) {
        return context.sendJson({}, 'notFound');
    }

    return module.exports.sendArrayOutput({ context, records, outputType });
}

// Flatten a FHIR Appointment resource into designer-friendly fields. The full
// resource is kept under `resource` so no data is lost.
function normalizeAppointment(resource) {

    const participants = (resource.participant || []).map(p => ({
        reference: p.actor && p.actor.reference,
        display: p.actor && p.actor.display,
        status: p.status
    }));
    const byType = prefix => participants.filter(p => (p.reference || '').startsWith(prefix));
    const patient = byType('Patient/')[0] || {};

    return {
        id: resource.id,
        status: resource.status,
        start: resource.start,
        end: resource.end,
        minutesDuration: resource.minutesDuration,
        created: resource.created,
        description: resource.description,
        comment: resource.comment,
        serviceType: (((resource.serviceType || [])[0] || {}).coding || [{}])[0].display
            || ((resource.serviceType || [])[0] || {}).text,
        appointmentType: (resource.appointmentType || {}).text,
        reason: (((resource.reasonCode || [])[0] || {}).coding || [{}])[0].display
            || ((resource.reasonCode || [])[0] || {}).text,
        patient: patient.display,
        patientReference: patient.reference,
        practitioners: byType('Practitioner/').map(p => p.display).filter(Boolean),
        locations: byType('Location/').map(p => p.display).filter(Boolean),
        participants,
        lastUpdated: (resource.meta || {}).lastUpdated,
        resource
    };
}

// How far back the polling window reaches. Wide enough to catch updates and
// cancellations of recent appointments without pulling the whole history.
const POLL_LOOKBACK_DAYS = 30;

// Shared tick() implementation for the appointment polling triggers.
// `mode` is one of 'new' | 'updated' | 'cancelled'. The first tick only primes
// the state (nothing is emitted), subsequent ticks diff against it.
async function pollAppointments(context, mode) {

    const { patient } = context.properties;
    if (!patient) {
        throw new context.CancelError('Patient ID is required!');
    }

    const since = new Date(Date.now() - POLL_LOOKBACK_DAYS * 24 * 3600 * 1000)
        .toISOString().slice(0, 10);
    const bundle = await fhirRequest(context, {
        resource: 'Appointment',
        params: { patient, date: `ge${since}` }
    });
    const items = extractResources(bundle);

    const state = context.state || {};
    const known = state.known;
    const next = {};
    const changed = [];

    for (const r of items) {
        const hash = JSON.stringify([r.status, r.start, r.end, r.minutesDuration, (r.meta || {}).lastUpdated]);
        next[r.id] = { status: r.status, hash };
        if (!known) continue;
        const prev = known[r.id];
        if (mode === 'new' && !prev) {
            changed.push(r);
        } else if (mode === 'updated' && prev && prev.hash !== hash) {
            changed.push(r);
        } else if (mode === 'cancelled' && r.status === 'cancelled' && (!prev || prev.status !== 'cancelled')) {
            changed.push(r);
        }
    }

    await context.saveState({ known: next });

    for (const r of changed) {
        await context.sendJson(normalizeAppointment(r), 'out');
    }
}

// Flow Test Mode helper for the appointment triggers: return any existing
// appointment of the patient (normalized) or null when there is none.
async function findTestAppointment(context) {

    const { patient } = context.properties;
    if (!patient) {
        throw new context.CancelError('Patient ID is required!');
    }

    const since = new Date(Date.now() - POLL_LOOKBACK_DAYS * 24 * 3600 * 1000)
        .toISOString().slice(0, 10);
    const bundle = await fhirRequest(context, {
        resource: 'Appointment',
        params: { patient, date: `ge${since}` }
    });
    const [appointment] = extractResources(bundle);
    return appointment ? normalizeAppointment(appointment) : null;
}

Object.assign(module.exports, {
    FHIR_BASE_URL,
    OAUTH_BASE_URL,
    getFhirBaseUrl,
    getOauthBaseUrl,
    fhirRequest,
    extractResources,
    runPatientSearch,
    normalizeAppointment,
    pollAppointments,
    findTestAppointment
});
