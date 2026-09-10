#!/usr/bin/env node
'use strict';

// Runs the Google Drive trigger stress test end to end against the instance the appmixer CLI
// is currently logged in to. See README.md for what it proves and how to read the report.
//
//   node run.js --account <appmixer:google:drive accountId> [--files 300] [--delay 200] [--keep]

const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

const HERE = __dirname;
const TRIGGER_FLOW = 'stress-flow-drive-trigger-under-test.json';
const PROVOKER_FLOW = 'stress-flow-drive-burst-provoker.json';

// Flow identity on the instance, the same shape the E2E tooling uses (customFields.connector
// is the canonical connector ref, customFields.name is the flow name) with its own category, so
// stress flows are findable but never land in an E2E listing, store or report.
const STRESS_CATEGORY = 'Stress_test_flow';

// The Drive change channel needs a moment after the flow starts before changes reach it.
const CHANNEL_WARMUP_MS = 60 * 1000;
// The provoker deletes its folder five minutes after the last file; that delete is the signal
// that the run is over. Give it the file creation time plus a generous margin.
const RUN_TIMEOUT_MS = 25 * 60 * 1000;
const POLL_INTERVAL_MS = 20 * 1000;
// A flow start right after a connector publish can hit a worker with a stale module snapshot.
const START_ATTEMPTS = 4;

const parseArgs = (argv) => {
    const args = { files: 300, delay: 200, keep: false, account: null, cleanupWait: null, connector: null };
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg === '--keep') args.keep = true;
        else if (arg === '--account') args.account = argv[++i];
        else if (arg === '--files') args.files = parseInt(argv[++i], 10);
        else if (arg === '--delay') args.delay = parseInt(argv[++i], 10);
        else if (arg === '--cleanup-wait') args.cleanupWait = argv[++i];
        else if (arg === '--connector') args.connector = argv[++i];
        else throw new Error(`Unknown argument: ${arg}`);
    }
    if (!args.account) throw new Error('Missing --account <accountId>. Use an appmixer:google:drive account.');
    if (!(args.files > 0)) throw new Error('--files must be a positive number.');
    if (args.cleanupWait && !/^[0-9]+[mhdwMy]$/.test(args.cleanupWait)) {
        throw new Error('--cleanup-wait takes an Appmixer interval such as 5m.');
    }
    return args;
};

const cli = (args, options = {}) => {
    return execFileSync('appmixer', args, { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, ...options });
};

const sleep = (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
};

const now = () => {
    return new Date().toISOString();
};

const log = (message) => {
    process.stdout.write(`[${now().slice(11, 19)}] ${message}\n`);
};

// Fresh component ids per run: the component id is the key of the engine lock the trigger
// takes, so two runs sharing ids would share a lock and measure each other.
const randomizeIds = (flow) => {
    let json = JSON.stringify(flow);
    for (const id of Object.keys(flow.flow)) json = json.split(id).join(crypto.randomUUID());
    return JSON.parse(json);
};

const patchProvoker = (flow, { files, delay, cleanupWait }) => {
    for (const component of Object.values(flow.flow)) {
        const transform = component.config && component.config.transform;
        if (!transform) continue;
        for (const port of Object.values(transform.in || {})) {
            for (const spec of Object.values(port)) {
                const lambda = spec.lambda || {};
                const variables = lambda.variables;
                if (variables && Array.isArray(variables.ADD)) {
                    for (const variable of variables.ADD) {
                        if (variable.name === 'list') {
                            variable.text = JSON.stringify(Array.from({ length: files }, (_, i) => i + 1));
                        }
                    }
                }
                if (typeof lambda.delay === 'number') {
                    lambda.delay = delay;
                }
                if (cleanupWait && typeof lambda.interval === 'string') {
                    lambda.interval = cleanupWait;
                }
            }
        }
    }
    return flow;
};

// Component manifests of every module the flows use, keyed by component type. The engine
// resolves a flow node by (type, version): a version the instance does not have fails the
// start with "No compatible version", and one that resolves to a stale registry row fails it
// with "Missing component.json". The files on disk carry the versions of the code in this
// repo, so they are re-pinned to what the instance actually serves before the flow is created.
const readManifests = (flows) => {
    const types = new Set();
    for (const flow of flows) {
        for (const component of Object.values(flow.flow)) types.add(component.type);
    }
    const modules = new Set([...types].map(type => type.split('.').slice(0, 3).join('.')));
    const manifests = new Map();
    for (const module of modules) {
        const listed = JSON.parse(cli(['component', 'ls', '-m', module, '--json']));
        for (const manifest of listed) manifests.set(manifest.name, manifest);
    }
    const missing = [...types].filter(type => !manifests.has(type));
    if (missing.length) throw new Error(`Not published on this instance: ${missing.join(', ')}`);
    return manifests;
};

const pinVersions = (flow, manifests) => {
    for (const component of Object.values(flow.flow)) {
        component.version = manifests.get(component.type).version || '1.0.0';
    }
    return flow;
};

// Every component whose manifest declares an auth service needs the account bound to it.
const accountComponentIds = (flow, manifests) => {
    return Object.entries(flow.flow)
        .filter(([, component]) => manifests.get(component.type).auth)
        .map(([id]) => id);
};

// The canonical connector ref of the connector these flows belong to, derived from where this
// script sits: <repo>/src/appmixer/<vendor>[/<module>]/artifacts/stress-flows -> appmixer:vendor.
const connectorRef = () => {
    const parts = HERE.split(path.sep);
    const root = parts.lastIndexOf('appmixer');
    const artifacts = parts.lastIndexOf('artifacts');
    if (root < 0 || artifacts < 0 || artifacts <= root) {
        throw new Error(`Cannot derive the connector ref from ${HERE}; pass --connector <ref>.`);
    }
    return ['appmixer', ...parts.slice(root + 1, artifacts)].join(':');
};

const stampIdentity = (flow, ref) => {
    flow.customFields = Object.assign({}, flow.customFields, {
        category: STRESS_CATEGORY,
        connector: ref,
        name: flow.name
    });
    return flow;
};

// Every run uploads its own copy of the two flows and removes them again at the end, so there is
// no lookup of a previous run's flows: `appmixer flow ls` only returns the first hundred flows
// on the instance and has no way to filter by customFields, so a `--keep` leftover cannot be
// found again reliably. Keep a run only when you intend to look at it and remove it by hand.
const uploadFlow = (file) => {
    const out = cli(['flow', 'create', file]);
    const match = out.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/);
    if (!match) throw new Error(`Could not read the flow id out of:\n${out}`);
    return match[1];
};

const startFlow = async (flowId, label) => {
    for (let attempt = 1; attempt <= START_ATTEMPTS; attempt++) {
        try {
            cli(['flow', 'start', flowId], { stdio: ['ignore', 'pipe', 'pipe'] });
            log(`started ${label} (${flowId})`);
            return;
        } catch (err) {
            const message = (err.stdout || '') + (err.stderr || '');
            if (attempt === START_ATTEMPTS) throw new Error(`Could not start ${label}:\n${message}`);
            log(`start of ${label} failed (attempt ${attempt}/${START_ATTEMPTS}), retrying - ${message.split('\n')[0]}`);
            await sleep(10 * 1000);
        }
    }
};

const readLogs = (flowId, since) => {
    const hits = [];
    const page = 500;
    for (let from = 0; ; from += page) {
        const out = cli([
            'logs', '--flow-id', flowId,
            '-q', `gridTimestamp:[${since} TO *]`,
            '-s', String(page), '--from', String(from), '--json'
        ]);
        let parsed;
        try {
            parsed = JSON.parse(out);
        } catch (err) {
            throw new Error(`Could not parse the log response: ${out.slice(0, 300)}`);
        }
        const rows = parsed.hits || [];
        for (const hit of rows) hits.push(hit['_source'] || hit);
        if (rows.length < page) break;
    }
    return hits;
};

const isEmission = (entry) => {
    return entry.componentType === 'appmixer.google.drive.NewFileOrFolder' && (entry.msg || '').startsWith('{"isFolder"');
};

const fileNameOf = (entry) => {
    const match = (entry.msg || '').match(/"name":"([^"]+)"/);
    return match && match[1];
};

const summarize = (entries) => {
    const seen = new Map();
    const runs = [];
    const errors = [];
    for (const entry of entries) {
        if (isEmission(entry)) {
            const name = fileNameOf(entry);
            if (name) seen.set(name, (seen.get(name) || 0) + 1);
        }
        if ((entry.msg || '').includes('"changes-processed"')) {
            try {
                runs.push(JSON.parse(entry.msg));
            } catch (err) {
                // a truncated log line is not worth failing the report over
            }
        }
        if ((entry.severity || entry.level) === 'error') {
            errors.push(`${(entry.gridTimestamp || '').slice(11, 19)} ${(entry.componentType || '-').split('.').pop()} ${(entry.msg || '').slice(0, 120)}`);
        }
    }
    const emitted = [...seen.values()].reduce((sum, count) => sum + count, 0);
    const duplicates = [...seen.entries()].filter(([, count]) => count > 1);
    return { emitted, distinct: seen.size, duplicates, runs, errors };
};

const lockErrors = (errors) => {
    return errors.filter(line => /LockError|lock-lost|Cannot extend|timed out/i.test(line));
};

const main = async () => {
    const args = parseArgs(process.argv.slice(2));
    const expected = args.files + 1; // the files plus the folder they are created in

    log(`instance: ${cli(['url']).trim()}`);

    const ref = args.connector || connectorRef();
    const sources = {
        trigger: JSON.parse(fs.readFileSync(path.join(HERE, TRIGGER_FLOW), 'utf8')),
        provoker: JSON.parse(fs.readFileSync(path.join(HERE, PROVOKER_FLOW), 'utf8'))
    };
    const manifests = readManifests(Object.values(sources));
    log(`uploading the ${ref} stress flows as category ${STRESS_CATEGORY}`);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'drive-stress-'));
    const flows = {};
    for (const [key, file] of [['trigger', TRIGGER_FLOW], ['provoker', PROVOKER_FLOW]]) {
        const flow = randomizeIds(sources[key]);
        pinVersions(flow, manifests);
        stampIdentity(flow, ref);
        if (key === 'provoker') patchProvoker(flow, args);
        const target = path.join(tmp, file);
        fs.writeFileSync(target, JSON.stringify(flow, null, 4));
        flows[key] = { file: target, accountComponents: accountComponentIds(flow, manifests) };
    }

    let triggerFlowId = null;
    let provokerFlowId = null;
    let failure = null;
    const startedAt = now();

    try {
        triggerFlowId = uploadFlow(flows.trigger.file);
        provokerFlowId = uploadFlow(flows.provoker.file);
        cli(['auth', 'bind-account', args.account, ...flows.trigger.accountComponents]);
        cli(['auth', 'bind-account', args.account, ...flows.provoker.accountComponents]);
        log(`uploaded trigger ${triggerFlowId} and provoker ${provokerFlowId}`);

        await startFlow(triggerFlowId, 'the trigger under test');
        log(`waiting ${CHANNEL_WARMUP_MS / 1000}s for the Drive change channel`);
        await sleep(CHANNEL_WARMUP_MS);
        await startFlow(provokerFlowId, `the provoker (${args.files} files, ${args.delay}ms apart)`);

        const deadline = Date.now() + RUN_TIMEOUT_MS;
        let created = 0;
        for (;;) {
            await sleep(POLL_INTERVAL_MS);
            const entries = readLogs(provokerFlowId, startedAt);
            created = entries.filter(entry => {
                return entry.componentType === 'appmixer.google.drive.CreateFileFromText' &&
                    (entry.msg || '').startsWith('{"content"');
            }).length;
            const done = entries.some(entry => entry.componentType === 'appmixer.google.drive.DeleteFileOrFolder');
            log(`provoker: ${created}/${args.files} files created${done ? ', folder deleted' : ''}`);
            if (done) break;
            if (Date.now() > deadline) {
                failure = `the provoker did not finish within ${RUN_TIMEOUT_MS / 60000} minutes (${created}/${args.files} files created)`;
                break;
            }
        }

        const report = summarize(readLogs(triggerFlowId, startedAt));
        const locks = lockErrors(report.errors);
        const pages = report.runs.reduce((sum, run) => sum + (run.pages || 0), 0);
        const deferred = report.runs.filter(run => run.deferred).length;
        const slowest = report.runs.reduce((max, run) => Math.max(max, run.durationMs || 0), 0);

        process.stdout.write([
            '',
            '--- Google Drive trigger stress test ---------------------------------',
            `files created by the provoker : ${created} of ${args.files}`,
            `emitted by the trigger        : ${report.emitted} (${report.distinct} distinct, expected at least ${expected})`,
            `duplicate emissions           : ${report.duplicates.length}`,
            `runs of checkMonitoredFiles   : ${report.runs.length} (${pages} pages, ${deferred} deferred, slowest ${slowest}ms)`,
            `lock / timeout errors         : ${locks.length}`,
            `other errors                  : ${report.errors.length - locks.length}`,
            ''
        ].join('\n'));

        for (const line of locks.slice(0, 10)) process.stdout.write(`  lock error: ${line}\n`);
        for (const [name, count] of report.duplicates.slice(0, 10)) process.stdout.write(`  emitted ${count}x: ${name}\n`);
        if (!report.runs.length) {
            process.stdout.write('  note: no changes-processed lines - the module on the instance predates that log line\n');
        }

        if (!failure && locks.length) failure = `${locks.length} lock or timeout error(s) on the trigger`;
        if (!failure && report.duplicates.length) failure = `${report.duplicates.length} file(s) emitted more than once`;
        if (!failure && report.distinct < expected) failure = `only ${report.distinct} of ${expected} files reached the trigger`;
    } catch (err) {
        failure = err.message;
    } finally {
        for (const [label, flowId] of [['trigger', triggerFlowId], ['provoker', provokerFlowId]]) {
            if (!flowId) continue;
            try {
                cli(['flow', 'stop', flowId], { stdio: ['ignore', 'pipe', 'pipe'] });
                if (!args.keep) {
                    cli(['flow', 'remove', flowId], { stdio: ['ignore', 'pipe', 'pipe'] });
                    log(`removed the ${label} flow`);
                } else {
                    log(`kept the ${label} flow: ${flowId}`);
                }
            } catch (err) {
                log(`could not clean up the ${label} flow ${flowId}: ${err.message.split('\n')[0]}`);
            }
        }
    }

    if (failure) {
        process.stdout.write(`FAILED: ${failure}\n`);
        process.exit(1);
    }
    process.stdout.write('PASSED\n');
};

main().catch(err => {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
});
