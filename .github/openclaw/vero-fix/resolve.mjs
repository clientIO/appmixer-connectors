#!/usr/bin/env node
// Fix stage — TRUSTED step 1. Prepares what vero works on: a worktree of the PR head branch (from the
// apx-vero fork, so it can be pushed back) and the logs of the Testing run that failed.
//
//   node resolve.mjs <pr> <testingRun> <itemNodeId> <projectNodeId> <statusFieldId> <target>
//
// Prints RUN_DIR=<dir>, or BLOCKED: <reason> after reporting it.
'use strict';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, copyFileSync, symlinkSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = '/root/.openclaw/workspace-vero/pipeline-fix';
const TESTING_RUNS = '/root/.openclaw/workspace-vero/pipeline-testing/runs';
const BASE_CLONE = '/root/.openclaw/workspace-vero/mention-responder/repo';
const REPO = 'Appmixer-ai/appmixer-connectors';

const [prArg, testingRun, itemNodeId, projectNodeId, statusFieldId, target] = process.argv.slice(2);
const pr = Number(prArg);
if (!(pr > 0) || !/^\d+-\d{8}-\d{6}$/.test(testingRun || '') || !/^PVTI_[\w-]+$/.test(itemNodeId || '') || !/^PVT_[\w-]+$/.test(projectNodeId || '')
    || !/^PVTSSF_[\w-]+$/.test(statusFieldId || '') || !/^Appmixer-ai\/[\w.-]+#\d+$/.test(target || '')) {
    console.log('REFUSED: bad arguments');
    process.exit(0);
}
const env = Object.fromEntries(readFileSync('/root/.openclaw/.env', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const TOKEN = env.GITHUB_VERO_PAT;
const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..*/, '').replace('T', '-');
const runDir = path.join(ROOT, 'runs', `${pr}-${stamp}`);
mkdirSync(runDir, { recursive: true });
const ctx = { pr, prUrl: `https://github.com/${REPO}/pull/${pr}`, testingRun, itemNodeId, projectNodeId, statusFieldId, target, runDir };

function blocked(summary) {
    writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({ ...ctx, blocked: summary }, null, 2));
    const finish = spawnSync('node', [path.join(ROOT, 'finish.mjs'), runDir, '--blocked', summary], { encoding: 'utf8' });
    console.log(finish.stdout.trim());
    console.log('BLOCKED: ' + summary);
    process.exit(0);
}

const res = await fetch(`https://api.github.com/repos/${REPO}/pulls/${pr}`, { headers: { authorization: 'Bearer ' + TOKEN, accept: 'application/vnd.github+json', 'user-agent': 'pipeline-fix' } });
const p = await res.json();
if (p.state !== 'open') blocked(`PR #${pr} is ${p.state}.`);
if (p.user?.login !== 'apx-vero' || p.head?.repo?.owner?.login !== 'apx-vero') blocked(`PR #${pr} is not apx-vero's PR from its fork; vero cannot push a fix to it.`);

// The failed Testing run: its result and every log
const testingDir = path.join(TESTING_RUNS, testingRun);
if (!existsSync(path.join(testingDir, 'result.json'))) blocked(`The Testing run ${testingRun} has no result.`);
const logs = path.join(runDir, 'testing-logs');
mkdirSync(logs);
for (const f of readdirSync(testingDir)) if (/\.(log|json)$/.test(f)) copyFileSync(path.join(testingDir, f), path.join(logs, f));
const testing = JSON.parse(readFileSync(path.join(testingDir, 'result.json'), 'utf8'));

// The head branch from the fork, in a worktree on a local branch that can be pushed back
const repo = path.join(runDir, 'repo');
const branch = p.head.ref;
const lock = path.join(BASE_CLONE, '..', '.git.lock');
const flock = (args) => spawnSync('flock', [lock, 'git', '-C', BASE_CLONE, ...args], { encoding: 'utf8' });
flock(['fetch', '-q', 'origin', p.base.ref]);
const f1 = flock(['fetch', '-q', 'fork', `refs/heads/${branch}:refs/remotes/fork/${branch}`]);
if (f1.status !== 0) blocked('Could not fetch the PR branch from the fork: ' + f1.stderr.slice(0, 200));
const w = flock(['worktree', 'add', '-q', '-B', `fix-${pr}-${stamp}`, repo, `fork/${branch}`]);
if (w.status !== 0) blocked('Could not prepare the worktree: ' + w.stderr.slice(0, 200));
symlinkSync(path.join(BASE_CLONE, 'node_modules'), path.join(repo, 'node_modules'));
const headSha = git(['rev-parse', 'HEAD'], repo).stdout.trim();
if (headSha !== p.head.sha) blocked(`The PR head moved (${p.head.sha.slice(0, 7)} on GitHub, ${headSha.slice(0, 7)} in the fork) — Testing has to run again first.`);

writeFileSync(path.join(runDir, 'run.json'), JSON.stringify({
    ...ctx, title: p.title, branch, headSha, baseRef: p.base.ref,
    testing: { summary: testing.summary, report: testing.report, codeFailures: testing.codeFailures }
}, null, 2));
console.log('RUN_DIR=' + runDir);
