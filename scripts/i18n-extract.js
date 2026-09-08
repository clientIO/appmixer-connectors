#!/usr/bin/env node
'use strict';
/**
 * Extract localizable strings of a connector module into the i18n.<lang>.json skeleton
 * (English values, keyed the way the Designer resolves `localization`).
 *
 * Usage: node scripts/i18n-extract.js src/appmixer/<vendor>/<module> [--check i18n.de.json ...]
 *
 * Sections: components (path-style keys), modules (module.json), service (service.json
 * of the parent connector, if any), auth (auth.js definition fields).
 * With --check, every listed i18n file is compared against the skeleton and missing /
 * unknown keys are reported (exit code 1 when any are found).
 */
const fs = require('fs');
const path = require('path');

const args = process.argv.slice(2);
const checkIdx = args.indexOf('--check');
const dir = path.resolve(args[0]);
const checkFiles = checkIdx === -1 ? [] : args.slice(checkIdx + 1);

const readJson = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const isText = (v) => typeof v === 'string' && v.trim();

function* componentFiles(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
        if (e.name === 'node_modules' || e.name === 'artifacts') continue;
        const p = path.join(d, e.name);
        if (e.isDirectory()) yield* componentFiles(p);
        else if (e.name === 'component.json') yield p;
    }
}

function extractInput(prefix, input, out) {
    if (isText(input.label)) out[`${prefix}.label`] = input.label;
    if (isText(input.tooltip)) out[`${prefix}.tooltip`] = input.tooltip;
    if (isText(input.placeholder)) out[`${prefix}.placeholder`] = input.placeholder;
    const dt = input.attrs && input.attrs.label && input.attrs.label['data-tooltip'];
    if (isText(dt)) out[`${prefix}.attrs.label.data-tooltip`] = dt;
    if (Array.isArray(input.options)) {
        input.options.forEach((o, j) => {
            // static select options carry either `label` or `content`
            if (o && isText(o.label)) out[`${prefix}.options[${j}].label`] = o.label;
            else if (o && isText(o.content)) out[`${prefix}.options[${j}].content`] = o.content;
        });
    }
    // `expression` inputs carry a nested inspector in `fields`
    if (input.fields && typeof input.fields === 'object') {
        for (const [name, field] of Object.entries(input.fields)) {
            extractInput(`${prefix}.fields.${name}`, field, out);
        }
    }
}

function extractInspector(prefix, inspector, out) {
    if (!inspector) return;
    for (const [name, group] of Object.entries(inspector.groups || {})) {
        if (group && isText(group.label)) out[`${prefix}.inspector.groups.${name}.label`] = group.label;
    }
    for (const [name, input] of Object.entries(inspector.inputs || {})) {
        extractInput(`${prefix}.inspector.inputs.${name}`, input, out);
    }
}

function extractComponent(manifest) {
    const out = {};
    if (isText(manifest.label)) out.label = manifest.label;
    if (isText(manifest.description)) out.description = manifest.description;
    if (manifest.properties) extractInspector('properties', manifest.properties.inspector, out);
    (manifest.inPorts || []).forEach((port, i) => extractInspector(`inPorts[${i}]`, port.inspector, out));
    (manifest.outPorts || []).forEach((port, i) => {
        (Array.isArray(port.options) ? port.options : []).forEach((o, j) => {
            if (o && isText(o.label)) out[`outPorts[${i}].options[${j}].label`] = o.label;
        });
    });
    return out;
}

function extractManifestMeta(manifest) {
    const out = {};
    for (const k of ['label', 'description', 'categoryLabel']) {
        if (isText(manifest[k])) out[k] = manifest[k];
    }
    return out;
}

function extractAuth(authFile) {
    if (!fs.existsSync(authFile)) return {};
    const def = require(authFile).definition || {};
    let fields = def.auth || {};
    if (typeof def.pre === 'function') {
        // collect fields for every configuration branch we can reach
        for (const config of [{}, { globalKeys: false }]) {
            try { fields = { ...fields, ...def.pre({ config }) }; } catch (e) { /* ignore */ }
        }
    }
    const out = {};
    for (const [name, field] of Object.entries(fields)) {
        if (isText(field.name)) out[`auth.${name}.name`] = field.name;
        if (isText(field.tooltip)) out[`auth.${name}.tooltip`] = field.tooltip;
    }
    return out;
}

function skeleton() {
    const result = { components: {}, modules: {}, service: {}, auth: {} };
    for (const f of componentFiles(dir)) {
        const manifest = readJson(f);
        result.components[manifest.name] = extractComponent(manifest);
    }
    const moduleFile = path.join(dir, 'module.json');
    if (fs.existsSync(moduleFile)) {
        const m = readJson(moduleFile);
        result.modules[m.name] = extractManifestMeta(m);
    }
    for (const serviceFile of [path.join(dir, 'service.json'), path.join(dir, '..', 'service.json')]) {
        if (fs.existsSync(serviceFile)) {
            result.service = extractManifestMeta(readJson(serviceFile));
            break;
        }
    }
    result.auth = extractAuth(path.join(dir, 'auth.js'));
    return result;
}

function flatten(obj) {
    const out = {};
    for (const [section, entries] of Object.entries(obj)) {
        if (section === 'components' || section === 'modules') {
            for (const [name, strings] of Object.entries(entries)) {
                for (const k of Object.keys(strings)) out[`${section}.${name}.${k}`] = strings[k];
            }
        } else {
            for (const k of Object.keys(entries)) out[`${section}.${k}`] = entries[k];
        }
    }
    return out;
}

const base = skeleton();
if (checkFiles.length === 0) {
    process.stdout.write(JSON.stringify(base, null, 4) + '\n');
    process.exit(0);
}

const expected = flatten(base);
let failed = false;
for (const file of checkFiles) {
    const actual = flatten(readJson(path.resolve(file)));
    const missing = Object.keys(expected).filter((k) => !(k in actual));
    const unknown = Object.keys(actual).filter((k) => !(k in expected));
    const untranslated = Object.keys(actual).filter((k) => k in expected && actual[k] === expected[k]);
    console.log(`${file}: ${Object.keys(actual).length}/${Object.keys(expected).length} keys, `
        + `${missing.length} missing, ${unknown.length} unknown, ${untranslated.length} identical to EN`);
    missing.forEach((k) => console.log(`  missing: ${k}`));
    unknown.forEach((k) => console.log(`  unknown: ${k}`));
    if (missing.length || unknown.length) failed = true;
}
process.exit(failed ? 1 : 0);
