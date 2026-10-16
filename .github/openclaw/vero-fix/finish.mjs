#!/usr/bin/env node
// Fix stage — TRUSTED last step and the only GitHub writer. Reads <run>/decision.json, pushes vero's
// commits to the PR branch in the apx-vero fork, and reports the result: pushed → the card goes back
// to Testing; nothing pushed → Needs input with vero's explanation.
//
//   node finish.mjs <runDir>                 (end of vero's turn)
//   node finish.mjs <runDir> --blocked <why>  (resolve.mjs stopped early)
'use strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const ROOT = '/root/.openclaw/workspace-vero/pipeline-fix';
const BASE_CLONE = '/root/.openclaw/workspace-vero/mention-responder/repo';
const [runDir, flag, why] = process.argv.slice(2);
if (!runDir || !path.resolve(runDir).startsWith(path.join(ROOT, 'runs') + '/')) { console.log('REFUSED: run dir outside ' + ROOT); process.exit(1); }
const run = JSON.parse(readFileSync(path.join(runDir, 'run.json'), 'utf8'));
const env = Object.fromEntries(readFileSync('/root/.openclaw/.env', 'utf8').split('\n')
    .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].trim().replace(/^["']|["']$/g, '')]));
const TOKEN = env.GITHUB_VERO_PAT;
const callback = JSON.parse(readFileSync('/root/.openclaw/pipeline/callback.json', 'utf8'));
const git = (args, cwd) => spawnSync('git', args, { cwd, encoding: 'utf8' });

async function report(result, summary, details) {
    const body = { secret: callback.secret, stage: 'Fix', result, summary, report: details, pr: run.pr, prUrl: run.prUrl,
        itemNodeId: run.itemNodeId, projectNodeId: run.projectNodeId, statusFieldId: run.statusFieldId, target: run.target,
        runDir: path.basename(runDir), at: new Date().toISOString() };
    writeFileSync(path.join(runDir, 'result.json'), JSON.stringify(body, (k, v) => (k === 'secret' ? '***' : v), 2));
    const res = await fetch(callback.url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    console.log('REPORTED: ' + result + ' (callback ' + res.status + ')');
}

try {
    if (flag === '--blocked') {
        await report('blocked', why || 'The fix stage stopped before vero looked at the failure.', '');
    } else {
        const repo = path.join(runDir, 'repo');
        const decisionFile = path.join(runDir, 'decision.json');
        const decision = existsSync(decisionFile) ? JSON.parse(readFileSync(decisionFile, 'utf8')) : null;
        const commits = git(['log', '--format=%h %s', `${run.headSha}..HEAD`], repo).stdout.trim();
        if (commits) {
            const push = git(['push', '-q', `https://x-access-token:${TOKEN}@github.com/apx-vero/appmixer-connectors.git`, `HEAD:refs/heads/${run.branch}`], repo);
            if (push.status !== 0) throw new Error('push failed: ' + push.stderr.replace(TOKEN, '***').slice(0, 200));
            const lines = commits.split('\n').map((c) => `- \`${c.slice(0, 7)}\` ${c.slice(8)}`);
            await report('passed', String(decision?.summary || 'vero pushed a fix; Testing runs again.').slice(0, 600),
                [...lines, decision?.details ? '\n' + String(decision.details).slice(0, 3000) : ''].join('\n'));
        } else {
            await report('blocked', String(decision?.summary || 'vero did not produce a fix (no decision.json, no commit).').slice(0, 600),
                decision?.details ? String(decision.details).slice(0, 3000) : '');
        }
    }
} catch (err) {
    console.log('ERROR: ' + String(err.message || err).replace(TOKEN, '***'));
    try { await report('blocked', 'The fix stage failed: ' + String(err.message || err).replace(TOKEN, '***').slice(0, 300), ''); } catch { /* nothing more */ }
} finally {
    if (existsSync(path.join(runDir, 'repo'))) git(['worktree', 'remove', '--force', path.join(runDir, 'repo')], BASE_CLONE);
}
