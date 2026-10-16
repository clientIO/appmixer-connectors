// Hook transform for POST /hooks/maya-docs (trusted gateway code).
// Called by "CI - project status -> pipeline" when a card of the @appmixer-connectors project moves to
// Doc&Verification. Validates every value and hands the maya agent a FIXED instruction.
const PR_URL = /^https:\/\/github\.com\/appmixer-ai\/appmixer-connectors\/pull\/(\d{1,7})$/i;
const ITEM = /^PVTI_[A-Za-z0-9_-]{5,80}$/;
const PROJECT = /^PVT_[A-Za-z0-9_-]{5,80}$/;
const FIELD = /^PVTSSF_[A-Za-z0-9_-]{5,80}$/;
const TARGET = /^Appmixer-ai\/[A-Za-z0-9_.-]{1,100}#\d{1,7}$/;

export default function transform({ payload }) {
    const p = payload || {};
    const pr = (PR_URL.exec(String(p.pr_url || '').trim()) || [])[1];
    const item = String(p.item_node_id || '').trim();
    const project = String(p.project_node_id || '').trim();
    const field = String(p.status_field_id || '').trim();
    const target = String(p.target || '').trim();
    if (!pr || !ITEM.test(item) || !PROJECT.test(project) || !FIELD.test(field) || !TARGET.test(target)) {
        return null; // 204
    }
    return {
        kind: 'agent',
        agentId: 'maya',
        name: `pipeline Doc&Verification of PR #${pr}`,
        sessionMode: 'isolated',
        deliver: false,
        timeoutSeconds: 1800,
        message: [
            `Check the app registration guide for pull request #${pr} of Appmixer-ai/appmixer-connectors.`,
            'Follow /root/.openclaw/workspace-maya/docs-pipeline/INSTRUCTIONS.md exactly, starting with:',
            `cd /root/.openclaw/workspace-maya/docs-pipeline && node resolve.mjs ${pr} ${item} ${project} ${field} ${target}`
        ].join(' ')
    };
}
