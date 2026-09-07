'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const IGNORED_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', '.cache']);

// Returns the set of files (absolute paths) that differ from `baseRef`, plus any
// staged and unstaged changes in the working tree. Used by validate.js --changed
// to scope validation to a diff (strict on new work, ignore legacy debt).
//
// Resolution order for the diff base:
//   1. merge-base between baseRef and HEAD (so only this branch's changes count)
//   2. if baseRef is unknown (e.g. CI without it fetched), fall back to
//      staged + unstaged only and report baseResolved=false so the caller can warn.
function getChangedFiles(repoRoot, baseRef) {

    const git = (args) => {
        return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8' });
    };

    const tryGit = (args) => {
        try {
            return git(args);
        } catch (err) {
            return null;
        }
    };

    const files = new Set();
    const addLines = (output) => {
        if (!output) return;
        for (const line of output.split('\n')) {
            const trimmed = line.trim();
            if (trimmed) {
                files.add(path.resolve(repoRoot, trimmed));
            }
        }
    };

    // Working tree: unstaged + staged. Always included.
    addLines(tryGit(['diff', '--name-only', '--diff-filter=d']));
    addLines(tryGit(['diff', '--name-only', '--cached', '--diff-filter=d']));

    // Committed changes on this branch vs the base ref.
    let baseResolved = false;
    let baseCommit = null;
    const mergeBase = tryGit(['merge-base', baseRef, 'HEAD']);

    if (mergeBase) {
        baseCommit = mergeBase.trim();
        addLines(tryGit(['diff', '--name-only', '--diff-filter=d', baseCommit, 'HEAD']));
        baseResolved = true;
    }

    return { files, baseResolved, baseCommit };
}

// Returns the contents of `relPath` (repo-relative) at git ref `ref`, or null if
// the file did not exist there (e.g. a newly added file).
function getFileAtRef(repoRoot, ref, relPath) {

    if (!ref) return null;

    try {
        return execFileSync('git', ['show', `${ref}:${relPath}`], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
    } catch (err) {
        return null;
    }
}

function isGitRepo(repoRoot) {

    try {
        execFileSync('git', ['rev-parse', '--is-inside-work-tree'], {
            cwd: repoRoot,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        });
        return true;
    } catch (err) {
        return false;
    }
}

function walkFiles(dirPath, matcher, result = []) {

    let entries;

    try {
        entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch (err) {
        return result;
    }

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
            if (!IGNORED_DIRS.has(entry.name)) {
                walkFiles(fullPath, matcher, result);
            }
            continue;
        }

        if (matcher(fullPath)) {
            result.push(fullPath);
        }
    }

    return result;
}

function readJson(filePath) {

    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function makeRelativePath(repoRoot) {

    return function relativePath(filePath) {
        return path.relative(repoRoot, filePath);
    };
}

function parseVersion(version) {

    const match = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version);

    if (!match) {
        return null;
    }

    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
        prerelease: match[4] || ''
    };
}

function compareVersions(left, right) {

    for (const key of ['major', 'minor', 'patch']) {
        if (left[key] !== right[key]) {
            return left[key] - right[key];
        }
    }

    if (left.prerelease === right.prerelease) {
        return 0;
    }

    if (!left.prerelease) {
        return 1;
    }

    if (!right.prerelease) {
        return -1;
    }

    return left.prerelease.localeCompare(right.prerelease, undefined, {
        numeric: true,
        sensitivity: 'base'
    });
}

module.exports = {
    walkFiles,
    readJson,
    makeRelativePath,
    parseVersion,
    compareVersions,
    getChangedFiles,
    getFileAtRef,
    isGitRepo
};
