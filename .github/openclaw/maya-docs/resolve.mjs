#!/usr/bin/env node
// Doc&Verification stage — TRUSTED step 1. Prepares everything maya works on and nothing else.
//
//   node resolve.mjs <pr> <itemNodeId> <projectNodeId> <statusFieldId> <target>
//
// Prints RUN_DIR=<dir> (the run dir holds run.json, connectors/ = a worktree of the PR head,
// docs/ = a worktree of the docs repo's app-registrations branch on a fresh branch) or
// BLOCKED: <reason> after reporting it to Appmixer itself.
'use strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = '/root/.openclaw/workspace-maya/docs-pipeline';
const CONNECTORS_CLONE = '/root/.openclaw/workspace-maya/appmixer-connectors';
const DOCS_CLONE = '/root/.openclaw/workspace-maya/appmixer-docs-gitbook';
const REPO = 'Appmixer-ai/appmixer-connectors';
const DOCS_BASE = 'app-registrations';

const [prArg, itemNodeId, projectNodeId, statusFieldId, target] = process.argv.slice(2);
const pr = Number(prArg);
if (!(pr > 0) || !/^PVTI_[\w-]+$/.test(itemNodeId || '') || !/^PVT_[\w-]+$/.test(projectNodeId || '')
    || !/^PVTSSF_[\w-]+$/.test(statusFieldId || '') || !/^Appmixer-ai\/[\w.-]+#\d+$/.test(target || '')) {
    console.log('REFUSED: bad arguments');
    process.exit(0);
}
const env = Object.fromEntries(readFileSync('/root/.openclaw/.env', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const TOKEN = env.GITHUB_MAYA_PAT;
const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const gh = async (p) => {
    const res = await fetch('https://api.github.com' + p, { headers: { authorization: 'Bearer ' + TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'docs-pipeline' } });
    if (!res.ok) throw new Error(`GitHub ${p}: ${res.status}`);
    return res.json();
};
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
const runDir = path.join(ROOT, 'runs', `${pr}-${stamp}`);
mkdirSync(runDir, { recursive: true });
const ctx = { pr, prUrl: `https://github.com/${REPO}/pull/${pr}`, itemNodeId, projectNodeId, statusFieldId, target, runDir };

async function blocked(summary) {
    writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ ...ctx, blocked: summary }, null, 2));
    const finish = spawnSync('node', [path.join(ROOT, 'finish.mjs'), runDir, '--blocked', summary], { encoding: 'utf8' });
    console.log(finish.stdout.trim());
    console.log('BLOCKED: ' + summary);
    process.exit(0);
}

const p = await gh(`/repos/${REPO}/pulls/${pr}`);
if (p.state !== 'open') await blocked(`PR #${pr} is ${p.state}.`);
if (!(p.user.login === 'apx-vero' || ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(p.author_association))) {
    await blocked(`PR #${pr} is by ${p.user.login} (${p.author_association}); its documentation is not written automatically.`);
}

// The PR head, in a worktree of maya's connectors clone
const connectors = path.join(runDir, 'connectors');
git(['fetch', '-q', 'upstream', p.base.ref], CONNECTORS_CLONE);
const f1 = git(['fetch', '-q', 'upstream', `pull/${pr}/head:refs/remotes/pr/${pr}`], CONNECTORS_CLONE);
if (f1.status !== 0) await blocked('Could not fetch the PR head: ' + f1.stderr.slice(0, 200));
git(['worktree', 'add', '-q', '--detach', connectors, p.head.sha], CONNECTORS_CLONE);
const base = git(['merge-base', 'HEAD', `upstream/${p.base.ref}`], connectors).stdout.trim();
const files = git(['diff', '--name-only', `${base}...HEAD`], connectors).stdout.split('\n').filter((f) => f.startsWith('src/appmixer/'));
const bundles = new Set();
for (const f of files) {
    let dir = path.dirname(f);
    while (dir.startsWith('src/appmixer/') && dir !== 'src/appmixer') {
        if (existsSync(path.join(connectors, dir, 'bundle.json'))) { bundles.add(dir); break; }
        dir = path.dirname(dir);
    }
}
if (!bundles.size) await blocked(`PR #${pr} changes no connector — no app registration guide to check.`);

// The docs repo, fresh branch from upstream app-registrations
const docs = path.join(runDir, 'docs');
const branch = `docs/pr-${pr}-${stamp}`;
git(['fetch', '-q', 'upstream', DOCS_BASE], DOCS_CLONE);
const w2 = git(['worktree', 'add', '-q', '-b', branch, docs, `upstream/${DOCS_BASE}`], DOCS_CLONE);
if (w2.status !== 0) await blocked('Could not prepare the docs worktree: ' + w2.stderr.slice(0, 200));
const docsBaseSha = git(['rev-parse', 'HEAD'], docs).stdout.trim();

const list = [...bundles].map((dir) => {
    // Vendor-level service.json carries the service name (appmixer.spotify); a module dir may not
    let serviceDir = dir;
    while (!existsSync(path.join(connectors, serviceDir, 'service.json')) && serviceDir !== 'src/appmixer') serviceDir = path.dirname(serviceDir);
    const service = existsSync(path.join(connectors, serviceDir, 'service.json')) ? JSON.parse(readFileSync(path.join(connectors, serviceDir, 'service.json'), 'utf8')) : {};
    const authFile = [dir, serviceDir].map((d) => path.join(connectors, d, 'auth.js')).find((f) => existsSync(f));
    const authType = authFile ? ((readFileSync(authFile, 'utf8').match(/type:\s*['"](\w+)['"]/) || [])[1] || 'unknown') : 'none';
    const slug = String(service.name || dir).split('.').pop().toLowerCase();
    const page = `app-registrations/${slug}.md`;
    return { dir, ref: dir.replace(/^src\//, '').split('/').join(':'), service: service.name || null, label: service.label || slug, authFile: authFile ? path.relative(connectors, authFile) : null, authType, page, pageExists: existsSync(path.join(docs, page)) };
});
writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ ...ctx, title: p.title, headSha: p.head.sha, docsBranch: branch, docsBaseSha, connectors: list }, null, 2));
console.log('RUN_DIR=' + runDir);
