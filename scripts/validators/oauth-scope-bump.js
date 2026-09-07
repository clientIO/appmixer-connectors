'use strict';

// What this validator checks (DIFF-AWARE)
// ---------------------------------------
// Adding an OAuth scope to a component's `auth.scope` forces every existing user
// of the connector to re-authenticate — a breaking change. So when `auth.scope`
// grows relative to the base ref, the connector must:
//   • bump bundle.json to the next MAJOR version, and
//   • mark the latest changelog entry as BREAKING.
//
// This validator only runs when a diff base is available (i.e. `validate.js
// --changed`); in whole-repo mode `context.baseRef` is null and it no-ops —
// there is no "before" to compare against.
//
// For each changed component.json that gained scopes vs the base:
//   FAILURE  — connector bundle.json major version was not bumped.
//   WARNING  — latest changelog entry does not mention BREAKING.
//
// New component files (absent at the base) are skipped — declaring scopes on a
// brand-new component is not a regression.
//
// See 08-best-practices.md ("OAuth Scope Changes are Breaking Changes").

const path = require('path');

const { readJson, getFileAtRef, parseVersion } = require('./_shared');

function parseJsonSafe(text) {

    try {
        return JSON.parse(text);
    } catch (err) {
        return null;
    }
}

function getScopes(component) {

    const scope = component && component.auth && component.auth.scope;
    return Array.isArray(scope) ? scope.filter((s) => typeof s === 'string') : [];
}

function connectorRoot(componentPath) {

    // .../src/appmixer/<vendor>/.../<Component>/component.json
    const parts = componentPath.split(path.sep);
    const idx = parts.lastIndexOf('appmixer');
    if (idx < 0 || idx + 1 >= parts.length) return null;
    return parts.slice(0, idx + 2).join(path.sep);
}

function latestChangelogEntries(bundle) {

    const changelog = bundle && bundle.changelog;
    if (!changelog || typeof changelog !== 'object') return [];

    const versions = Object.keys(changelog)
        .map(parseVersion)
        .filter(Boolean);

    if (versions.length === 0) return [];

    // Pick the highest semver key.
    let latestKey = null;
    let latest = null;
    for (const key of Object.keys(changelog)) {
        const v = parseVersion(key);
        if (!v) continue;
        if (!latest || compareSemver(v, latest) > 0) {
            latest = v;
            latestKey = key;
        }
    }

    const entries = latestKey ? changelog[latestKey] : null;
    return Array.isArray(entries) ? entries : [];
}

function compareSemver(a, b) {

    if (a.major !== b.major) return a.major - b.major;
    if (a.minor !== b.minor) return a.minor - b.minor;
    return a.patch - b.patch;
}

function validateComponent(context, componentPath) {

    const { repoRoot, baseRef, relativePath, addFailure, addWarning } = context;

    let component;
    try {
        component = readJson(componentPath);
    } catch (error) {
        addFailure(componentPath, `failed to parse JSON: ${error.message}`);
        return;
    }

    const newScopes = getScopes(component);
    if (newScopes.length === 0) return;

    const relPath = relativePath(componentPath);
    const oldText = getFileAtRef(repoRoot, baseRef, relPath);
    if (oldText === null) return; // new file — not a regression

    const oldComponent = parseJsonSafe(oldText);
    if (!oldComponent) return;

    const oldScopes = getScopes(oldComponent);
    const added = newScopes.filter((s) => !oldScopes.includes(s));
    if (added.length === 0) return;

    const root = connectorRoot(componentPath);
    if (!root) return;

    const bundlePath = path.join(root, 'bundle.json');
    const bundleRel = relativePath(bundlePath);

    let newBundle;
    try {
        newBundle = readJson(bundlePath);
    } catch (err) {
        addFailure(componentPath, `added OAuth scope(s) [${added.join(', ')}] but connector bundle.json could not be read`);
        return;
    }

    const oldBundle = parseJsonSafe(getFileAtRef(repoRoot, baseRef, bundleRel) || '');
    const newVer = parseVersion(newBundle.version || '');
    const oldVer = oldBundle ? parseVersion(oldBundle.version || '') : null;

    if (!newVer) {
        addFailure(componentPath, `added OAuth scope(s) [${added.join(', ')}] but connector bundle.json has an unparseable version "${newBundle.version}"`);
        return;
    }

    if (oldVer && newVer.major <= oldVer.major) {
        addFailure(componentPath, `added OAuth scope(s) [${added.join(', ')}] — this is a breaking change and requires a MAJOR version bump in bundle.json (currently ${oldVer.major}.x → ${newBundle.version})`);
    }

    const entries = latestChangelogEntries(newBundle);
    const mentionsBreaking = entries.some((e) => typeof e === 'string' && /breaking/i.test(e));
    if (!mentionsBreaking) {
        addWarning(componentPath, `added OAuth scope(s) [${added.join(', ')}] — latest changelog entry should be marked BREAKING and note that existing users must re-authenticate`);
    }
}

module.exports = {
    name: 'oauth-scope-bump',
    description: 'added OAuth scopes require a major version bump + BREAKING changelog (diff-aware)',
    run(context) {
        if (!context.baseRef) {
            return; // whole-repo mode: no base to diff against
        }
        for (const componentPath of context.componentFiles) {
            validateComponent(context, componentPath);
        }
    }
};
