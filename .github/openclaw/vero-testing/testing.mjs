#!/usr/bin/env node
// Testing stage of the status-driven connector pipeline (Appmixer-ai/appmixer-components#2890) —
// TRUSTED, deterministic. Started in the background by start.sh when a card moves to Testing.
//
//   node testing.mjs <runDir> <pr> <itemNodeId> <projectNodeId> <statusFieldId> <target>
//
// 1. Preconditions: the PR is open, its author is trusted (we publish its code to the QA instance),
//    Node.js CI is green on its head commit, it changes at least one connector with E2E flows.
// 2. For each changed connector (lock per connector, the QA instance is shared): publish it to
//    dev-automated-00001, import its E2E flows from the PR head, run each one.
// 3. Post the result to the "pipeline stage result" Appmixer integration, which writes the report
//    into the item's pipeline comment and moves the card (passed → Review, failed → In Progress).
//
// Nothing here comes from the hook payload except the validated arguments above.
'use strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, openSync, closeSync, symlinkSync } from 'node:fs';
import path from 'node:path';

const ROOT = '/root/.openclaw/workspace-vero/pipeline-testing';
const PIPELINE = '/root/.openclaw/pipeline';
const BASE_CLONE = '/root/.openclaw/workspace-vero/mention-responder/repo';
const REPO = 'Appmixer-ai/appmixer-connectors';
const CI_CHECK = 'build'; // job of .github/workflows/nodejs.yml
const CI_WAIT_MS = 25 * 60 * 1000;
const MAX_CONNECTORS = 3;
const FLOW_TIMEOUT_MS = 12 * 60 * 1000;
// Trial modes for running by hand on the host: no callback (the card does not move), no publish (the
// instance keeps its installed connector version; the PR's E2E flows run against it).
const DRY = process.env.PIPELINE_DRY === '1';
const SKIP_PUBLISH = process.env.PIPELINE_SKIP_PUBLISH === '1';

const [runDir, prArg, itemNodeId, projectNodeId, statusFieldId, target] = process.argv.slice(2);
const pr = Number(prArg);
// Filled in once known; sent with every result so the fix stage can pick it up
const extra = { codeFailures: 0, fixable: false, testingRun: path.basename(runDir || '') };
const log = (...a) => console.log(new Date().toISOString(), ...a);
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));
const env = Object.fromEntries(readFileSync('/root/.openclaw/.env', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const GH_TOKEN = env.GITHUB_VERO_PAT;
const appmixer = readJson(path.join(PIPELINE, 'appmixer.json'));
const callback = readJson(path.join(PIPELINE, 'callback.json'));

const gh = async (p) => {
    const res = await fetch('https://api.github.com' + p, { headers: { authorization: 'Bearer ' + GH_TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'pipeline-testing' } });
    if (!res.ok) throw new Error(`GitHub ${p}: ${res.status}`);
    return res.json();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Appmixer API token for the CLI (APPMIXER_TOKEN + APPMIXER_API_URL). */
async function appmixerEnv() {
    const res = await fetch(appmixer.apiUrl + '/user/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: appmixer.username, password: appmixer.password }) });
    if (!res.ok) throw new Error('Appmixer login failed: ' + res.status);
    const { token } = await res.json();
    return { ...process.env, APPMIXER_TOKEN: token, APPMIXER_API_URL: appmixer.apiUrl + '/', APPMIXER_SKILL_UI_URL: appmixer.uiUrl, APPMIXER_NO_BANNER: '1' };
}

function run(cmd, args, opts = {}) {
    const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, ...opts });
    const out = (r.stdout || '') + (r.stderr || '');
    return { code: r.status, out };
}

/** Holds an exclusive lock file while fn runs; waits for another run of the same key. */
async function withLock(key, fn) {
    const file = path.join(PIPELINE, 'locks', key.replace(/[^A-Za-z0-9_.-]/g, '_') + '.lock');
    for (;;) {
        try {
            const fd = openSync(file, 'wx');
            writeFileSync(fd, String(process.pid));
            closeSync(fd);
            break;
        } catch {
            // A lock older than 2 hours belongs to a dead run
            try { if (Date.now() - statSync(file).mtimeMs > 2 * 3600 * 1000) { execFileSync('rm', ['-f', file]); continue; } } catch { continue; }
            log('waiting for lock', key);
            await sleep(30000);
        }
    }
    try { return await fn(); } finally { execFileSync('rm', ['-f', file]); }
}

async function report(result, summary, details) {
    const body = {
        secret: callback.secret,
        stage: 'Testing',
        result, // passed | failed | blocked
        summary,
        report: details,
        pr,
        prUrl: `https://github.com/${REPO}/pull/${pr}`,
        itemNodeId,
        projectNodeId,
        statusFieldId,
        target,
        runDir: path.basename(runDir),
        ...extra,
        at: new Date().toISOString()
    };
    writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(body, (k, v) => (k === 'secret' ? '***' : v), 2));
    if (DRY) { log('DRY: no callback', result, summary); return; }
    const res = await fetch(callback.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    log('callback', res.status);
}

/**
 * Why a failed import or flow needs a person rather than a code fix, or null. These come from the
 * environment of the QA instance, not from the connector: no account bound, a consent without a
 * scope the component needs, a token the provider revoked, a provider account out of quota.
 * @param {string} out - CLI output
 * @param {string} ref - appmixer:<connector>
 */
function environmentProblem(out, ref) {
    const service = ref.split(':').slice(1).join(':');
    const rules = [
        [/No account ID|no account (found|bound)|Unbound account|account is not bound/i, `no ${service} account is connected on dev-automated-00001`],
        [/missing (OAuth )?scopes?|Access token not found|insufficient[_ ]scope/i, `the ${service} account on dev-automated-00001 lacks a scope the components need — re-authorize it`],
        [/invalid_grant|token (has )?expired|revoked|InvalidTokenError|401 Unauthorized|status code 401/i, `the ${service} token on dev-automated-00001 is expired or revoked — re-authorize the account`],
        [/no credits remaining|insufficient_quota|exceeded your current quota|billing|credit balance is too low/i, `the ${service} provider account has no credit or quota left`]
    ];
    for (const [re, why] of rules) if (re.test(out)) return why;
    return null;
}

/** Directories (relative to the repo root) of the bundles the PR changes. */
function changedConnectors(worktree, baseSha) {
    const files = run('git', ['-C', worktree, 'diff', '--name-only', `${baseSha}...HEAD`]).out.split('\n').filter((f) => f.startsWith('src/appmixer/'));
    const bundles = new Set();
    for (const f of files) {
        let dir = path.dirname(f);
        while (dir.startsWith('src/appmixer/') && dir !== 'src/appmixer') {
            if (existsSync(path.join(worktree, dir, 'bundle.json'))) { bundles.add(dir); break; }
            dir = path.dirname(dir);
        }
    }
    return [...bundles];
}

/** The flow JSONs of a test-flows dir, picked the way `appmixer e2e import <dir>` picks them. */
function flowJsons(flowsDir) {
    if (!existsSync(flowsDir)) return [];
    const all = readdirSync(flowsDir).filter((f) => f.endsWith('.json'));
    const named = all.filter((f) => f.startsWith('test-flow-'));
    return (named.length ? named : all).sort().map((f) => path.join(flowsDir, f));
}

/**
 * E2E flows of a bundle: its own artifacts/test-flows, plus the flows of a parent connector dir that
 * use the bundle's components. The ai modules (ai/claude, ai/groq, …) keep most of their flows in
 * ai/artifacts/test-flows, next to the flows of the other modules.
 */
function bundleFlows(worktree, dir) {
    const own = flowJsons(path.join(worktree, dir, 'artifacts', 'test-flows'));
    const prefix = dir.replace(/^src\//, '').split('/').join('.') + '.'; // appmixer.ai.claude.
    const shared = [];
    for (let up = path.dirname(dir); up.startsWith('src/appmixer/') && up !== 'src/appmixer'; up = path.dirname(up)) {
        for (const file of flowJsons(path.join(worktree, up, 'artifacts', 'test-flows'))) {
            let flow = {};
            try { flow = JSON.parse(readFileSync(file, 'utf8')).flow || {}; } catch { continue; }
            if (Object.values(flow).some((c) => String(c.type || '').startsWith(prefix))) shared.push(file);
        }
    }
    return [...own, ...shared];
}

/**
 * Open pull requests of the connectors repo that close the issue (target "Appmixer-ai/<repo>#<n>").
 * Null when the target is not an issue (the card is the PR itself).
 */
async function linkedPullRequests() {
    const [repo, number] = target.split('#');
    if (repo === REPO) return null;
    const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { authorization: 'Bearer ' + GH_TOKEN, 'content-type': 'application/json', 'user-agent': 'pipeline-testing' },
        body: JSON.stringify({ query: `query { repository(owner: "${repo.split('/')[0]}", name: "${repo.split('/')[1]}") { issue(number: ${Number(number)}) {
            closedByPullRequestsReferences(first: 20, includeClosedPrs: false) { nodes { number state isDraft repository { nameWithOwner } } } } } }` })
    });
    const d = await res.json();
    const nodes = d?.data?.repository?.issue?.closedByPullRequestsReferences?.nodes;
    if (!nodes) throw new Error('could not read the PRs linked to ' + target + ': ' + JSON.stringify(d.errors || d).slice(0, 200));
    return nodes.filter((n) => n.state === 'OPEN' && n.repository.nameWithOwner === REPO);
}

async function main() {
    log('Testing PR', pr, 'item', itemNodeId, 'target', target);

    // --- 1. Preconditions
    // The issue has to point at exactly one open, non-draft PR of this repo
    const linked = await linkedPullRequests();
    if (linked) {
        const ready = linked.filter((n) => !n.isDraft);
        const list = (ns) => ns.map((n) => '#' + n.number).join(', ');
        if (ready.length > 1) {
            return report('blocked', `${target} is closed by ${ready.length} open pull requests that are ready for review (${list(ready)}). Testing needs exactly one: close or unlink the others, or mark them as drafts, then move the card to Testing again.`, ready.map((n) => `- https://github.com/${REPO}/pull/${n.number}`).join('\n'));
        }
        if (!ready.length) {
            return report('blocked', linked.length
                ? `${target} has only draft pull requests (${list(linked)}). Mark the one to test as ready for review, then move the card to Testing again.`
                : `${target} has no open pull request in ${REPO} that closes it (a closing keyword such as "Fixes ${target}" in the PR description).`, '');
        }
        if (ready[0].number !== pr) {
            log('the dispatcher chose', pr, 'but the only ready PR is', ready[0].number);
            return report('blocked', `The card points at PR #${pr}, but the only open PR ready for review is #${ready[0].number}. Move the card to Testing again.`, '');
        }
    }
    const p = await gh(`/repos/${REPO}/pulls/${pr}`);
    if (p.draft) return report('blocked', `PR #${pr} is a draft. Mark it as ready for review, then move the card to Testing again.`, '');
    if (p.state !== 'open') return report('blocked', `PR #${pr} is ${p.state}.`, '');
    const trusted = p.user.login === 'apx-vero' || ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(p.author_association);
    if (!trusted) {
        return report('blocked', `PR #${pr} is by ${p.user.login} (${p.author_association}); its code is not run on the QA instance automatically. A maintainer has to test it.`, '');
    }
    const headSha = p.head.sha;
    // vero can push a fix only to its own PR, whose head branch lives in the apx-vero fork
    extra.fixable = p.user.login === 'apx-vero' && p.head.repo && p.head.repo.owner.login === 'apx-vero';

    const started = Date.now();
    let ci = null;
    for (;;) {
        const runs = (await gh(`/repos/${REPO}/commits/${headSha}/check-runs?check_name=${CI_CHECK}&per_page=10`)).check_runs || [];
        ci = runs[0] || null;
        if (ci && ci.status === 'completed') break;
        if (Date.now() - started > CI_WAIT_MS) break;
        log('waiting for Node.js CI', ci ? ci.status : 'not started');
        await sleep(60000);
    }
    if (!ci || ci.status !== 'completed') return report('blocked', `Node.js CI did not finish on ${headSha.slice(0, 7)} within 25 minutes.`, '');
    if (ci.conclusion !== 'success') {
        return report('failed', `Node.js CI is ${ci.conclusion} on ${headSha.slice(0, 7)} — fix lint / validate / unit tests first.`, `- [Node.js CI](${ci.html_url}): **${ci.conclusion}**`);
    }

    // --- 2. Checkout of the PR head
    const worktree = path.join(runDir, 'repo');
    await withLock('git-base-clone', async () => {
        run('git', ['-C', BASE_CLONE, 'fetch', '-q', 'origin', p.base.ref]);
        const fetched = run('git', ['-C', BASE_CLONE, 'fetch', '-q', 'origin', `pull/${pr}/head:refs/remotes/pr/${pr}`]);
        if (fetched.code !== 0) throw new Error('fetch of the PR head failed: ' + fetched.out.slice(0, 300));
        const added = run('git', ['-C', BASE_CLONE, 'worktree', 'add', '-q', '--detach', worktree, headSha]);
        if (added.code !== 0) throw new Error('worktree add failed: ' + added.out.slice(0, 300));
    });
    symlinkSync(path.join(BASE_CLONE, 'node_modules'), path.join(worktree, 'node_modules'));
    const baseSha = run('git', ['-C', worktree, 'merge-base', 'HEAD', `origin/${p.base.ref}`]).out.trim();

    const connectors = changedConnectors(worktree, baseSha);
    if (!connectors.length) return report('blocked', `PR #${pr} changes no connector — nothing to test on the instance.`, '');
    if (connectors.length > MAX_CONNECTORS) return report('blocked', `PR #${pr} changes ${connectors.length} connectors (${connectors.join(', ')}); the Testing stage runs at most ${MAX_CONNECTORS}.`, '');
    const flowFiles = Object.fromEntries(connectors.map((d) => [d, bundleFlows(worktree, d)]));
    const withoutFlows = connectors.filter((d) => !flowFiles[d].length);
    if (withoutFlows.length) return report('blocked', `No E2E test flows for ${withoutFlows.join(', ')} (neither in its artifacts/test-flows nor in a parent connector's test-flows using its components).`, '');

    // --- 3. Publish, import, run
    const cliEnv = await appmixerEnv();
    const lines = [];
    let allPassed = true;
    const blockers = new Set(); // environment problems a person has to fix
    let codeFailures = 0; // flows that failed for any other reason
    for (const dir of connectors) {
        const ref = dir.replace(/^src\//, '').split('/').join(':'); // appmixer:microsoft:mail
        await withLock(ref, async () => {
            lines.push(`**${ref}**`);
            const zip = path.join(runDir, ref.replace(/:/g, '.') + '.zip');
            const packed = SKIP_PUBLISH ? { code: 0, out: 'skipped' } : run('appmixer', ['pack', path.join(worktree, dir), '-o', zip], { env: cliEnv, cwd: worktree });
            const published = SKIP_PUBLISH ? { code: 0, out: 'publish skipped (PIPELINE_SKIP_PUBLISH)' } : (packed.code === 0 ? run('appmixer', ['publish', zip], { env: cliEnv, cwd: worktree }) : packed);
            writeFileSync(path.join(runDir, `${ref}.publish.log`), published.out);
            // A plugin connector publish reports a cluster-sync error although it is complete
            if (published.code !== 0 && !/Some of the nodes returned errors/.test(published.out)) {
                allPassed = false;
                lines.push(`- publish failed: \`${published.out.trim().split('\n').pop().slice(0, 200)}\``);
                return;
            }
            // The API nodes may answer 5xx for a moment after a publish; the import is idempotent
            const GATEWAY = /status 50[234]|Bad Gateway|Service Unavailable|Gateway Timeout/;
            let imported = run('appmixer', ['e2e', 'import', ...flowFiles[dir], '--connectors-dir', worktree], { env: cliEnv, cwd: worktree });
            for (let attempt = 1; attempt < 3 && GATEWAY.test(imported.out); attempt++) {
                log('import answered 5xx, retrying in 30 s');
                await sleep(30000);
                imported = run('appmixer', ['e2e', 'import', ...flowFiles[dir], '--connectors-dir', worktree], { env: cliEnv, cwd: worktree });
            }
            writeFileSync(path.join(runDir, `${ref}.import.log`), imported.out);
            const importProblem = imported.code !== 0 ? environmentProblem(imported.out, ref) : null;
            if (importProblem) {
                allPassed = false;
                blockers.add(importProblem);
                lines.push(`- ⏸️ import: ${importProblem}`);
                return;
            }
            // A flow that did not import is reported, even when the others did
            for (const [, file, message] of imported.out.matchAll(/^\[ERROR\]:\s+(\S+\.json): (.+)$/gm)) {
                allPassed = false;
                const name = path.basename(file);
                if (GATEWAY.test(message)) {
                    blockers.add(`dev-automated-00001 kept answering ${message.match(/status \d+/) || '5xx'} to the flow import — move the card to Testing again later`);
                    lines.push(`- ⏸️ import of ${name}: ${message.slice(0, 160)}`);
                } else {
                    codeFailures += 1;
                    lines.push(`- ❌ import of ${name}: ${message.slice(0, 160)}`);
                }
            }
            // Run exactly the flows this import wrote ("✓ <name> → <flowId> (created|updated, <ref>)");
            // flows from a parent dir carry the parent's ref, so `e2e list -c <ref>` would miss them
            let flows = [...imported.out.matchAll(/^✓ (.+?) → ([0-9a-f-]{36}) \(/gm)].map((m) => ({ name: m[1], flowId: m[2] }));
            if (!flows.length) {
                const listed = run('appmixer', ['e2e', 'list', '-c', ref, '--json'], { env: cliEnv, cwd: worktree });
                try { const j = JSON.parse(listed.out.slice(Math.min(...['[', '{'].map((c) => listed.out.indexOf(c)).filter((i) => i >= 0)))); flows = Array.isArray(j) ? j : (j.flows || []); } catch { /* reported below */ }
            }
            if (!flows.length) {
                allPassed = false;
                if (!/^\[ERROR\]/m.test(imported.out)) {
                    codeFailures += 1;
                    lines.push(`- ❌ no E2E flow found on the instance after import (import exit ${imported.code}): \`${imported.out.trim().split('\n').pop().slice(0, 160)}\``);
                }
                return;
            }
            for (const f of flows) {
                const flowStarted = new Date(Date.now() - 5000).toISOString();
                const r = run('appmixer', ['e2e', 'run', f.flowId, '--fix'], { env: cliEnv, cwd: worktree, timeout: FLOW_TIMEOUT_MS });
                writeFileSync(path.join(runDir, `${ref}.${f.flowId}.run.log`), r.out);
                const line = (r.out.match(/^RESULT \| (\w+) \| ([^|]+)\|/m) || []);
                const passed = r.code === 0 && line[1] === 'PASSED';
                let problem = passed ? null : environmentProblem(r.out, ref);
                if (!passed && !problem) {
                    // The run output carries only "Request failed with status code 4xx"; the provider's
                    // answer (no credit, revoked key) is in the engine log of the flow
                    const logs = run('appmixer', ['logs', '--flow-id', f.flowId, '-q', 'severity:error', '--json'], { env: cliEnv, cwd: worktree, timeout: 120000 });
                    writeFileSync(path.join(runDir, `${ref}.${f.flowId}.engine.log`), logs.out.slice(0, 2000000));
                    // Only this run: the flow keeps the errors of earlier runs (e.g. another account)
                    let recent = '';
                    try {
                        const j = JSON.parse(logs.out.slice(Math.min(...['[', '{'].map((c) => logs.out.indexOf(c)).filter((i) => i >= 0))));
                        recent = JSON.stringify((Array.isArray(j) ? j : (j.hits || [])).map((h) => h._source || h)
                            .filter((h) => String(h['@timestamp'] || h.gridTimestamp || '') >= flowStarted));
                    } catch { recent = ''; }
                    problem = environmentProblem(recent, ref);
                }
                if (!passed) allPassed = false;
                if (problem) blockers.add(problem);
                else if (!passed) codeFailures += 1;
                const why = passed ? '' : ' — ' + (problem || ((r.out.match(/"message":\s*"([^"]+)"/) || r.out.match(/\[ERROR\]:\s*(.+)/) || r.out.match(/"reason":\s*"([^"]+)"/) || [, r.code === null ? 'timed out' : `exit ${r.code}`])[1]).slice(0, 160));
                lines.push(`- ${passed ? '✅' : problem ? '⏸️' : '❌'} [${(line[2] || f.name).trim()}](${appmixer.uiUrl}/designer/${f.flowId})${why}`);
            }
        });
    }
    const head = `E2E on dev-automated-00001, head ${headSha.slice(0, 7)}`;
    if (allPassed) return report('passed', `${head}: all flows passed.`, lines.join('\n'));
    // A real failure goes back to the developer; otherwise the environment needs a person first
    extra.codeFailures = codeFailures;
    if (codeFailures) return report('failed', `${head}: ${codeFailures} flow(s) failed.` + (blockers.size ? ' Also needs: ' + [...blockers].join('; ') + '.' : ''), lines.join('\n'));
    return report('blocked', `${head}: needs input — ${[...blockers].join('; ')}.`, lines.join('\n'));
}

mkdirSync(runDir, { recursive: true });
main().catch(async (err) => {
    log('runner error', err.stack || err);
    try { await report('blocked', 'The Testing runner failed: ' + String(err.message || err).slice(0, 300), ''); } catch (e) { log('callback failed', e); }
}).finally(() => {
    const worktree = path.join(runDir, 'repo');
    if (existsSync(worktree)) run('git', ['-C', BASE_CLONE, 'worktree', 'remove', '--force', worktree]);
    log('done');
});
