// Hook transform for POST /hooks/vero-fix (trusted gateway code).
// Called by "CI - pipeline stage result" when the Testing stage failed on code on a PR vero may push to.
// Validates every value and hands vero a FIXED instruction. One persistent session per PR, shared with
// the mention responder, so vero remembers the earlier fix rounds and what people asked on the PR.
const PR_URL = /^https:\/\/github\.com\/appmixer-ai\/appmixer-connectors\/pull\/(\d{1,7})$/i;
const ITEM = /^PVTI_[A-Za-z0-9_-]{5,80}$/;
const PROJECT = /^PVT_[A-Za-z0-9_-]{5,80}$/;
const FIELD = /^PVTSSF_[A-Za-z0-9_-]{5,80}$/;
const TARGET = /^Appmixer-ai\/[A-Za-z0-9_.-]{1,100}#\d{1,7}$/;
const RUN = /^\d{1,7}-\d{8}-\d{6}$/;

export default function transform({ payload }) {
    const p = payload || {};
    const pr = (PR_URL.exec(String(p.pr_url || '').trim()) || [])[1];
    const item = String(p.item_node_id || '').trim();
    const project = String(p.project_node_id || '').trim();
    const field = String(p.status_field_id || '').trim();
    const target = String(p.target || '').trim();
    const run = String(p.testing_run || '').trim();
    if (!pr || !ITEM.test(item) || !PROJECT.test(project) || !FIELD.test(field) || !TARGET.test(target) || !RUN.test(run)) {
        return null; // 204
    }
    return {
        kind: 'agent',
        agentId: 'vero',
        name: `pipeline Fix of PR #${pr}`,
        sessionKey: `hook:vero:gh:appmixer-connectors:pr:${pr}`,
        sessionMode: 'persistent',
        deliver: false,
        timeoutSeconds: 1800,
        message: [
            `The Testing stage failed on pull request #${pr} of Appmixer-ai/appmixer-connectors. Try to fix it.`,
            'Follow /root/.openclaw/workspace-vero/pipeline-fix/INSTRUCTIONS.md exactly, starting with:',
            `cd /root/.openclaw/workspace-vero/pipeline-fix && node resolve.mjs ${pr} ${run} ${item} ${project} ${field} ${target}`
        ].join(' ')
    };
}
