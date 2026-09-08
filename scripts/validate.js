'use strict';

// Thin wrapper over `appmixer connector validate` — the connector source
// validator suite now lives in the appmixer-cli repo (single source of truth;
// this repo's dev tracks the CLI's dev). Everything that used to call this
// file — the pre-commit hook, `npm run validate`, CI — keeps working
// unchanged; the rules themselves are the CLI's.
//
// What stays in THIS repo:
//   scripts/validators/bundle-bump-on-change.js   git-workflow rule (loaded via --rules-dir)
//   scripts/validators/oauth-scope-bump.js        git-workflow rule (loaded via --rules-dir)
//   scripts/validators/_shared.js                 helpers for the two above
//   validators.ignore.js                          repo-specific suppressions (repo root)
//   validators.thresholds.json                    repo-specific ratchet caps (repo root)
// The root data files are the CLI's standard workspace locations, picked up
// automatically; `--update-thresholds` writes back to validators.thresholds.json.
// (They used to live in scripts/validators/ as _ignore-list.js / .thresholds.json
// — an artifact of the pre-CLI runner, where anything in that dir without a `_`
// prefix was loaded as a rule. The CLI keeps a fallback for those legacy paths
// so older branches still validate.)
//
// Flag translation: the old runner took `--connector <name>`; the CLI takes
// the connector as a positional argument. Everything else passes through
// (--changed, --base, --update-thresholds, --show-suppressed, --show-ignored).

const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
const translated = [];

for (let i = 0; i < args.length; i++) {
    if (args[i] === '--connector') {
        translated.push(args[++i]);
        continue;
    }
    translated.push(args[i]);
}

const result = spawnSync('appmixer', [
    'connector', 'validate',
    '--connectors-dir', path.resolve(__dirname, '..'),
    '--rules-dir', path.join(__dirname, 'validators'),
    ...translated
], { stdio: 'inherit', shell: process.platform === 'win32' });

if (result.error && result.error.code === 'ENOENT') {
    console.error('appmixer CLI not found. The validator suite lives in appmixer-cli — install it first:');
    console.error('  npm install -g appmixer   (dev branch of Appmixer-ai/appmixer-cli until the release ships)');
    process.exit(1);
}

process.exit(result.status === null ? 1 : result.status);
