#!/usr/bin/env node
// Doc&Verification stage — TRUSTED last step. Reads <run>/decision.json (maya's verdict per
// connector), pushes the docs branch and opens the docs PR as apx-maya when maya committed
// something, links it from the connectors PR, and posts the stage result to Appmixer.
//
//   node finish.mjs <runDir>                 (normal end of maya's turn)
//   node finish.mjs <runDir> --blocked <why>  (resolve.mjs stopped early)
'use strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = '/root/.openclaw/workspace-maya/docs-pipeline';
const CONNECTORS_CLONE = '/root/.openclaw/workspace-maya/appmixer-connectors';
const DOCS_CLONE = '/root/.openclaw/workspace-maya/appmixer-docs-gitbook';
const DOCS_UP = 'Appmixer-ai/appmixer-docs-gitbook';
const DOCS_FORK = 'apx-maya/appmixer-docs-gitbook';
const REPO = 'Appmixer-ai/appmixer-connectors';

const [runDir, flag, why] = process.argv.slice(2);
if (!runDir || !path.resolve(runDir).startsWith(path.join(ROOT, 'runs') + '/')) { console.log('REFUSED: run dir outside ' + ROOT); process.exit(1); }
const run = JSON.parse(readFileSync(path.join(runDir, 'run.json'), 'utf8'));
const env = Object.fromEntries(readFileSync('/root/.openclaw/.env', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const TOKEN = env.GITHUB_MAYA_PAT;
const callback = JSON.parse(readFileSync('/root/.openclaw/pipeline/callback.json', 'utf8'));
const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const api = async (method, p, body) => {
    const res = await fetch('https://api.github.com' + p, { method, headers: { authorization: 'Bearer ' + TOKEN, accept: 'application/vnd.github+json', 'content-type': 'application/json', 'user-agent': 'docs-pipeline' }, body: body === undefined ? undefined : JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`${method} ${p}: ${res.status} ${JSON.stringify(data).slice(0, 200)}`);
    return data;
};

async function report(result, summary, details) {
    const body = { secret: callback.secret, stage: 'Doc&Verification', result, summary, report: details, pr: run.pr, prUrl: run.prUrl,
        itemNodeId: run.itemNodeId, projectNodeId: run.projectNodeId, statusFieldId: run.statusFieldId, target: run.target,
        runDir: path.basename(runDir), at: new Date().toISOString() };
    writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(body, (k, v) => (k === 'secret' ? '***' : v), 2));
    const res = await fetch(callback.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    console.log('REPORTED: ' + result + ' (callback ' + res.status + ')');
}

function cleanup() {
    for (const [clone, dir] of [[CONNECTORS_CLONE, 'connectors'], [DOCS_CLONE, 'docs']]) {
        if (existsSync(path.join(runDir, dir))) git(['worktree', 'remove', '--force', path.join(runDir, dir)], clone);
    }
}

try {
    if (flag === '--blocked') {
        await report('blocked', why || 'stopped before the docs were checked', '');
    } else {
        const decisionFile = path.join(runDir, 'decision.json');
        if (!existsSync(decisionFile)) {
            await report('blocked', 'maya did not write a decision (decision.json) — the docs were not checked.', '');
        } else {
            const decision = JSON.parse(readFileSync(decisionFile, 'utf8'));
            const docs = path.join(runDir, 'docs');
            const ahead = git(['rev-list', '--count', `${run.docsBaseSha}..HEAD`], docs).stdout.trim();
            let docsPr = null;
            if (Number(ahead) > 0) {
                const push = git(['push', '-q', `https://x-access-token:${TOKEN}@github.com/${DOCS_FORK}.git`, `HEAD:refs/heads/${run.docsBranch}`], docs);
                if (push.status !== 0) throw new Error('push of the docs branch failed: ' + push.stderr.replace(TOKEN, '***').slice(0, 200));
                const changed = (decision.connectors || []).filter((c) => ['created', 'updated'].includes(c.status));
                const title = `docs: ${changed.map((c) => c.label || c.ref).join(', ') || 'app registration'} — app registration guide (${REPO.split('/')[1]}#${run.pr})`;
                const prBody = [
                    '## Summary', '',
                    String(decision.summary || 'App registration guide for the connector changed in ' + run.prUrl + '.'), '',
                    ...changed.map((c) => `- \`${c.page}\` — ${c.status}: ${c.note || ''}`), '',
                    `Connector PR: ${run.prUrl}`, `Written by the Doc&Verification stage of the pipeline (Appmixer-ai/appmixer-components#2890) for ${run.target}.`, '',
                    '🤖 Generated with [Claude Code](https://claude.com/claude-code)'
                ].join('\n');
                docsPr = await api('POST', `/repos/${DOCS_UP}/pulls`, { title: title.slice(0, 250), head: `apx-maya:${run.docsBranch}`, base: 'app-registrations', body: prBody });
                await api('POST', `/repos/${REPO}/issues/${run.pr}/comments`, { body: `📖 App registration guide for this PR: ${docsPr.html_url}\n\n<!-- docs-pipeline:${run.pr} -->` });
            }
            const needsHuman = (decision.connectors || []).filter((c) => c.status === 'needs-human');
            const lines = (decision.connectors || []).map((c) => {
                const icon = { 'up-to-date': '✅', created: '📝', updated: '📝', 'not-needed': '➖', 'needs-human': '⏸️' }[c.status] || '•';
                return `- ${icon} **${c.label || c.ref}** \`${c.page || ''}\` — ${c.status}${c.note ? ': ' + c.note : ''}`;
            });
            if (docsPr) lines.push(`- Docs PR: ${docsPr.html_url}`);
            const summary = String(decision.summary || '').slice(0, 600) || (docsPr ? 'Docs PR opened.' : 'Docs are up to date.');
            await report(needsHuman.length ? 'blocked' : 'passed', needsHuman.length ? `Needs input — ${needsHuman.map((c) => c.note).join('; ')}` + (docsPr ? ` Docs PR: ${docsPr.html_url}` : '') : summary, lines.join('\n'));
        }
    }
} catch (err) {
    console.log('ERROR: ' + String(err.message || err).replace(TOKEN, '***'));
    try { await report('blocked', 'The docs stage failed: ' + String(err.message || err).replace(TOKEN, '***').slice(0, 300), ''); } catch { /* nothing more to do */ }
} finally {
    cleanup();
}
