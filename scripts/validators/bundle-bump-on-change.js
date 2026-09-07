'use strict';

// What this validator checks (DIFF-AWARE)
// ---------------------------------------
// When any shipped source file of a connector changes, the connector's
// bundle.json MUST get a version bump (and — via bundle-versions.js, which
// requires bundle.version to equal the latest changelog key — a new changelog
// entry). This keeps the marketplace version/changelog in sync with what
// actually shipped.
//
// For every changed connector (a directory containing a bundle.json) where a
// shipped source file changed:
//   FAILURE — bundle.json version was not increased vs the base ref
//             (either bundle.json was not touched, or its version is unchanged
//             or lower).
//
// What counts as a "shipped source" change
//   • .js and .json files under the connector (component.json, service.json,
//     auth.js, lib.js, *.js, schemas.js, …).
// What is ignored (does not require a bump)
//   • bundle.json itself (that is the file carrying the bump),
//   • test files (a `test` path segment or *.test.js),
//   • dev-only artifacts (an `artifacts` path segment),
//   • everything that is not .js / .json (.md, .svg, images, …).
//
// Brand-new connectors (no bundle.json at the base ref) are skipped — there is
// no previous version to compare against.
//
// This validator only runs when a diff base is available (i.e. `validate.js
// --changed`); in whole-repo mode `context.baseRef` is null and it no-ops.

const path = require('path');

const {
    readJson,
    getFileAtRef,
    getChangedFiles,
    parseVersion,
    compareVersions
} = require('./_shared');

function parseJsonSafe(text) {

    try {
        return JSON.parse(text);
    } catch (err) {
        return null;
    }
}

// True when changing this file should force a connector version bump.
function isShippedSourceFile(relWithinConnector) {

    const segments = relWithinConnector.split('/');
    const fileName = segments[segments.length - 1];

    if (fileName === 'bundle.json') return false;                // the bump carrier itself
    if (segments.includes('test') || segments.includes('tests')) return false;
    if (segments.includes('artifacts')) return false;
    if (/\.test\.js$/.test(fileName)) return false;

    const ext = path.extname(fileName).toLowerCase();
    return ext === '.js' || ext === '.json';
}

// Maps an absolute changed file to the deepest connector root (a directory that
// contains a bundle.json) that is an ancestor of it, or null.
function findConnectorRoot(filePath, sortedRoots) {

    for (const root of sortedRoots) {
        if (filePath === root) continue;
        if (filePath.startsWith(root + path.sep)) {
            return root;
        }
    }
    return null;
}

module.exports = {
    name: 'bundle-bump-on-change',
    description: 'a connector source change requires a bundle.json version bump (diff-aware)',
    run(context) {

        const { repoRoot, connectorsRoot, baseRef, walkFiles, relativePath, addFailure } = context;

        if (!baseRef) {
            return; // whole-repo mode: no base to diff against
        }

        // All connector roots in the repo (deepest first so nested connectors
        // like google/calendar win over a hypothetical parent).
        const bundlePaths = walkFiles(connectorsRoot, (filePath) => path.basename(filePath) === 'bundle.json');
        const sortedRoots = bundlePaths
            .map((bundlePath) => path.dirname(bundlePath))
            .sort((a, b) => b.length - a.length);

        const { files: changed } = getChangedFiles(repoRoot, baseRef);

        // connectorRoot -> list of repo-relative changed source files
        const touched = new Map();

        for (const filePath of changed) {
            const root = findConnectorRoot(filePath, sortedRoots);
            if (!root) continue;

            const relWithin = path.relative(root, filePath).split(path.sep).join('/');
            if (!isShippedSourceFile(relWithin)) continue;

            if (!touched.has(root)) touched.set(root, []);
            touched.get(root).push(relativePath(filePath));
        }

        for (const [root, changedFiles] of touched) {

            const bundlePath = path.join(root, 'bundle.json');
            const bundleRel = relativePath(bundlePath);

            let newBundle;
            try {
                newBundle = readJson(bundlePath);
            } catch (err) {
                addFailure(bundlePath, `connector source changed (${changedFiles.join(', ')}) but bundle.json is missing or unreadable`);
                continue;
            }

            const oldText = getFileAtRef(repoRoot, baseRef, bundleRel);
            if (oldText === null) {
                continue; // brand-new connector — no previous version to compare
            }

            const oldBundle = parseJsonSafe(oldText);
            const newVer = parseVersion(newBundle.version || '');
            const oldVer = oldBundle ? parseVersion(oldBundle.version || '') : null;

            // Leave invalid-version reporting to bundle-versions.js.
            if (!newVer || !oldVer) continue;

            if (compareVersions(newVer, oldVer) <= 0) {
                addFailure(bundlePath, `connector source changed (${changedFiles.join(', ')}) but bundle.json version was not bumped (still ${oldVer.major}.${oldVer.minor}.${oldVer.patch}); add a new version + changelog entry`);
            }
        }
    }
};
