// What a pipeline stage cost in model tokens — TRUSTED, read-only. Lives on the OpenClaw host as
// /root/.openclaw/pipeline/cost.mjs; the finish scripts send its result with the stage result, so
// the pipeline comment shows the price of each run.
//
// A stage run is the agent turn whose transcript mentions the run directory: the Testing launcher
// prints it, the fix and docs agents work inside it. The cost is summed from the user message that
// started that turn to the end, so a persistent session (one per PR) counts this run only.
// OpenClaw's own cost field is 0 for models it has no price for, so the price is computed here.
//
//   node cost.mjs <agent> <needle> [hours]   (prints the result, for a check by hand)
'use strict';
import { DatabaseSync } from 'node:sqlite';
import { zstdDecompressSync } from 'node:zlib';

// USD per million tokens: input, output, cache read, cache write (5 minutes)
const PRICES = [
    [/^claude-fable-5/, [10, 50, 0.25, 12.5]],
    [/^claude-opus-5-5/, [4, 20, 0.2, 5]],
    [/^claude-opus-(5|4-[5-8])/, [5, 25, 0.5, 6.25]],
    [/^claude-sonnet-5/, [2, 10, 0.2, 2.5]],
    [/^claude-sonnet-4/, [3, 15, 0.3, 3.75]],
    [/^claude-haiku-5-5/, [0.1, 0.5, 0.01, 0.125]],
    [/^claude-haiku-4-5/, [1, 5, 0.1, 1.25]]
];

export function price(model, usage) {
    const id = String(model || '').replace(/^[a-z-]+\//, '');
    const p = (PRICES.find(([re]) => re.test(id)) || [])[1];
    if (!p) return 0;
    const u = usage || {};
    // OpenClaw usage (input/output/cacheRead/cacheWrite) or Messages API usage
    const input = u.input ?? u.input_tokens ?? 0;
    const output = u.output ?? u.output_tokens ?? 0;
    const cacheRead = u.cacheRead ?? u.cache_read_input_tokens ?? 0;
    const cacheWrite = u.cacheWrite ?? u.cache_creation_input_tokens ?? 0;
    return (input * p[0] + output * p[1] + cacheRead * p[2] + cacheWrite * p[3]) / 1e6;
}

const decode = (json, zstd) => {
    if (json) return json;
    if (zstd) return zstdDecompressSync(zstd).toString('utf8');
    return '';
};

/** { usd, calls, tokens, models } of the agent turn(s) that mention `needle`, or null when none. */
export function stageCost(agent, needle, sinceMs = Date.now() - 12 * 3600 * 1000) {
    const db = new DatabaseSync(`/root/.openclaw/agents/${agent}/agent/openclaw-agent.sqlite`, { readOnly: true });
    try {
        const rows = db.prepare('SELECT session_id, seq, event_json, event_zstd FROM transcript_events WHERE created_at >= ? ORDER BY session_id, seq').all(sinceMs);
        const sessions = new Map();
        for (const row of rows) {
            const text = decode(row.event_json, row.event_zstd);
            if (!sessions.has(row.session_id)) sessions.set(row.session_id, []);
            sessions.get(row.session_id).push(text);
        }
        const total = { usd: 0, calls: 0, tokens: 0, models: [] };
        for (const events of sessions.values()) {
            const hit = events.findIndex((t) => t.includes(needle));
            if (hit < 0) continue;
            // Back to the user message that started the turn
            let start = hit;
            for (let i = hit; i >= 0; i--) {
                try { if ((JSON.parse(events[i]).message || {}).role === 'user') { start = i; break; } } catch { /* not JSON */ }
                start = i;
            }
            for (const text of events.slice(start)) {
                if (!text.includes('"usage"')) continue;
                let m;
                try { m = JSON.parse(text).message; } catch { continue; }
                if (!m || !m.usage) continue;
                total.usd += price(m.model, m.usage);
                total.calls += 1;
                total.tokens += (m.usage.input || 0) + (m.usage.output || 0) + (m.usage.cacheRead || 0) + (m.usage.cacheWrite || 0);
                if (m.model && !total.models.includes(m.model)) total.models.push(m.model);
            }
        }
        return total.calls ? total : null;
    } finally {
        db.close();
    }
}

/** stageCost() for a stage result: never throws, a failed lookup only means no price. */
export function costFields(agent, needle) {
    try {
        const c = stageCost(agent, needle);
        return c ? { costUsd: Math.round(c.usd * 10000) / 10000, costCalls: c.calls, costModels: c.models.join(', ') } : {};
    } catch (err) {
        console.log('cost lookup failed: ' + (err.message || err));
        return {};
    }
}

if (import.meta.url === `file://${process.argv[1]}`) {
    const [agent, needle, hours] = process.argv.slice(2);
    console.log(JSON.stringify(stageCost(agent, needle, Date.now() - (Number(hours) || 12) * 3600 * 1000)));
}
